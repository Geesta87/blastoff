import type { SupabaseClient } from '@supabase/supabase-js'
import { enqueueJob } from '@/lib/services/job-queue'

export type EventType =
  | 'contact_created'
  | 'tag_added'
  | 'tag_removed'
  | 'email_opened'
  | 'email_clicked'
  | 'sms_delivered'
  | 'sms_replied'
  | 'form_submitted'
  | 'webhook_received'

interface EmitEventOptions {
  workspaceId: string
  eventType: EventType
  contactId?: string
  payload?: Record<string, unknown>
  /** Chain depth for preventing infinite loops (automations triggering events that trigger automations) */
  chainDepth?: number
}

/**
 * Emit an event to the event_log table for automation processing.
 * Events are picked up by the cron-based event router which matches
 * them against active automations.
 */
export async function emitEvent(
  supabase: SupabaseClient,
  options: EmitEventOptions
): Promise<void> {
  const { workspaceId, eventType, contactId, payload, chainDepth } = options

  try {
    await supabase.from('event_log').insert({
      workspace_id: workspaceId,
      event_type: eventType,
      contact_id: contactId || (payload?.contact_id as string) || null,
      payload: {
        ...payload,
        ...(chainDepth !== undefined ? { _chain_depth: chainDepth } : {}),
      },
      processed: false,
    })
  } catch (err) {
    // Event emission should never crash the caller
    console.error('[EVENTS] Failed to emit event:', eventType, err)
  }
}

/** Maps event_log.event_type → automation trigger_type */
export const EVENT_TO_TRIGGER: Record<string, string> = {
  contact_created: 'contact_created',
  tag_added: 'tag_added',
  tag_removed: 'tag_removed',
  email_opened: 'email_opened',
  email_clicked: 'email_clicked',
  sms_delivered: 'sms_delivered',
  sms_replied: 'sms_replied',
  form_submitted: 'form_submitted',
  webhook_received: 'webhook_received',
}

const MAX_CHAIN_DEPTH = 5

/**
 * Check whether an event's trigger config matches the automation's trigger config.
 * e.g. for tag_added, verify the specific tag_id matches.
 */
export function matchesTriggerConfig(
  eventPayload: Record<string, unknown>,
  triggerConfig: Record<string, unknown>
): boolean {
  // tag_added / tag_removed — check tag_id
  if (triggerConfig.tag_id) {
    if (eventPayload.tag_id !== triggerConfig.tag_id) return false
  }

  // email_opened / email_clicked — check campaign_id
  if (triggerConfig.campaign_id) {
    if (eventPayload.campaign_id !== triggerConfig.campaign_id) return false
  }

  // webhook_received — check webhook_id
  if (triggerConfig.webhook_id) {
    if (eventPayload.webhook_id !== triggerConfig.webhook_id) return false
  }

  return true
}

/** Extract chain depth from event payload, respecting the max */
export function getChainDepth(payload: Record<string, unknown>): number {
  const depth = (payload._chain_depth as number) || 0
  return depth
}

/** Check if the chain depth exceeds the maximum allowed */
export function exceedsMaxChainDepth(payload: Record<string, unknown>): boolean {
  return getChainDepth(payload) >= MAX_CHAIN_DEPTH
}

/**
 * Process unprocessed events from event_log.
 * Matches events against active automations and creates runs.
 * Called from the cron handler alongside processJobs().
 */
export async function processEvents(supabase: SupabaseClient): Promise<{
  processed: number
  runsCreated: number
}> {
  // 1. Fetch batch of unprocessed events
  const { data: events, error } = await supabase
    .from('event_log')
    .select('*')
    .eq('processed', false)
    .order('created_at', { ascending: true })
    .limit(100)

  if (error || !events?.length) {
    return { processed: 0, runsCreated: 0 }
  }

  let runsCreated = 0

  for (const event of events) {
    try {
      const eventPayload = (event.payload as Record<string, unknown>) || {}
      const triggerType = EVENT_TO_TRIGGER[event.event_type as string]

      // Skip events with no matching trigger type
      if (!triggerType) {
        await supabase.from('event_log').update({ processed: true }).eq('id', event.id)
        continue
      }

      // Check chain depth to prevent infinite loops
      if (exceedsMaxChainDepth(eventPayload)) {
        console.warn('[EVENTS] Max chain depth exceeded, skipping event:', event.id)
        await supabase.from('event_log').update({ processed: true }).eq('id', event.id)
        continue
      }

      // 2. Find active automations matching this trigger type in this workspace
      const { data: automations } = await supabase
        .from('automations')
        .select('*')
        .eq('workspace_id', event.workspace_id)
        .eq('status', 'active')
        .eq('trigger_type', triggerType)

      if (!automations?.length) {
        await supabase.from('event_log').update({ processed: true }).eq('id', event.id)
        continue
      }

      const contactId = (event.contact_id as string) ||
        (eventPayload.contact_id as string) || null

      for (const automation of automations) {
        const triggerConfig = (automation.trigger_config as Record<string, unknown>) || {}

        // 3. Check trigger config match (e.g. specific tag_id)
        if (!matchesTriggerConfig(eventPayload, triggerConfig)) continue

        // 4. Skip if contact is already in an active run for this automation
        if (contactId) {
          const { data: existingRun } = await supabase
            .from('automation_runs')
            .select('id, completed_at')
            .eq('automation_id', automation.id)
            .eq('contact_id', contactId)
            .in('status', ['running', 'waiting'])
            .limit(1)
            .maybeSingle()

          if (existingRun) continue

          // 5. Check re-enrollment delay
          if (automation.allow_re_entry && automation.re_entry_delay) {
            const delay = parseDuration(automation.re_entry_delay as string)
            const cutoff = new Date(Date.now() - delay).toISOString()

            const { data: recentRun } = await supabase
              .from('automation_runs')
              .select('id')
              .eq('automation_id', automation.id)
              .eq('contact_id', contactId)
              .gte('completed_at', cutoff)
              .limit(1)
              .maybeSingle()

            if (recentRun) continue
          } else if (!automation.allow_re_entry) {
            // No re-entry allowed — check if contact ever ran this automation
            const { data: anyRun } = await supabase
              .from('automation_runs')
              .select('id')
              .eq('automation_id', automation.id)
              .eq('contact_id', contactId)
              .limit(1)
              .maybeSingle()

            if (anyRun) continue
          }
        }

        // 6. Create automation run
        const steps = (automation.steps as Record<string, unknown>[]) || []
        if (steps.length === 0) continue

        const chainDepth = getChainDepth(eventPayload)

        const { data: run } = await supabase
          .from('automation_runs')
          .insert({
            automation_id: automation.id,
            contact_id: contactId,
            workspace_id: event.workspace_id,
            status: 'running',
            trigger_data: eventPayload,
            current_step: 0,
          })
          .select('id')
          .single()

        if (!run) continue

        // 7. Enqueue first step
        await enqueueJob({
          workspaceId: event.workspace_id as string,
          type: 'automation_step',
          payload: {
            run_id: run.id,
            step_index: 0,
            workspace_id: event.workspace_id,
            _chain_depth: chainDepth,
          },
          priority: 2,
          idempotencyKey: `auto_${run.id}_step_0`,
        })

        runsCreated++
      }

      // 8. Mark event as processed
      await supabase.from('event_log').update({ processed: true }).eq('id', event.id)
    } catch (err) {
      console.error('[EVENTS] Error processing event:', event.id, err)
      // Mark as processed to avoid infinite retry
      await supabase.from('event_log').update({ processed: true }).eq('id', event.id)
    }
  }

  return { processed: events.length, runsCreated }
}

/**
 * Parse a human-readable duration string into milliseconds.
 * Supports: "30m", "2h", "1d", "1w"
 */
export function parseDuration(duration: string): number {
  const match = duration.match(/^(\d+)\s*(m|min|h|hr|d|day|w|wk)s?$/i)
  if (!match) return 3600000 // default 1 hour

  const num = parseInt(match[1], 10)
  const unit = match[2].toLowerCase()

  switch (unit) {
    case 'm':
    case 'min':
      return num * 60 * 1000
    case 'h':
    case 'hr':
      return num * 60 * 60 * 1000
    case 'd':
    case 'day':
      return num * 24 * 60 * 60 * 1000
    case 'w':
    case 'wk':
      return num * 7 * 24 * 60 * 60 * 1000
    default:
      return num * 60 * 1000
  }
}
