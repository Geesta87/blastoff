import { supabaseAdmin } from '@/lib/supabase/admin'
import { sendEmail } from '@/lib/services/sendgrid'
import { sendSMS, normalizePhone, TWILIO_ERRORS } from '@/lib/services/twilio'
import { calculateSMSSegments, COST_PER_SEGMENT } from '@/lib/utils/sms-segments'
import { publishToFacebook, publishToInstagram, refreshMetaToken } from '@/lib/services/meta'
import { publishToGBP, refreshGoogleToken } from '@/lib/services/google-business'
import { replaceMergeTags } from '@/lib/utils/merge-tags'

type JobType =
  | 'email_campaign_send'
  | 'sms_campaign_send'
  | 'automation_step'
  | 'social_post_publish'
  | 'token_refresh'
  | 'segment_recount'
  | 'engagement_fetch'

interface EnqueueOptions {
  workspaceId: string
  type: JobType
  payload: Record<string, unknown>
  executeAt?: Date
  priority?: number
  maxRetries?: number
  idempotencyKey?: string
}

export async function enqueueJob(options: EnqueueOptions): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from('job_queue')
    .insert({
      workspace_id: options.workspaceId,
      job_type: options.type,
      payload: options.payload,
      execute_at: (options.executeAt || new Date()).toISOString(),
      priority: options.priority ?? 5,
      max_retries: options.maxRetries ?? 3,
      idempotency_key: options.idempotencyKey || null,
    })
    .select('id')
    .single()

  if (error) {
    if (error.code === '23505') return null // idempotency conflict
    console.error('[JOB_QUEUE] Enqueue error:', error)
    throw error
  }
  return data.id
}

export async function processJobs(): Promise<{
  processed: number
  succeeded: number
  failed: number
}> {
  const { data: jobs, error } = await supabaseAdmin
    .from('job_queue')
    .select('*')
    .eq('status', 'pending')
    .lte('execute_at', new Date().toISOString())
    .order('priority', { ascending: true })
    .order('execute_at', { ascending: true })
    .limit(50)

  if (error || !jobs?.length) {
    return { processed: 0, succeeded: 0, failed: 0 }
  }

  const jobIds = jobs.map((j: Record<string, unknown>) => j.id as string)

  await supabaseAdmin
    .from('job_queue')
    .update({ status: 'processing', started_at: new Date().toISOString() })
    .in('id', jobIds)

  let succeeded = 0
  let failed = 0

  for (const job of jobs) {
    try {
      await handleJob(job)
      await supabaseAdmin
        .from('job_queue')
        .update({ status: 'completed', completed_at: new Date().toISOString() })
        .eq('id', job.id)
      succeeded++
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      const retryCount = ((job.retry_count as number) || 0) + 1
      const maxRetries = (job.max_retries as number) || 3

      if (retryCount < maxRetries) {
        const backoffMinutes = Math.pow(5, retryCount - 1)
        const nextExecute = new Date(Date.now() + backoffMinutes * 60 * 1000)
        await supabaseAdmin
          .from('job_queue')
          .update({
            status: 'pending',
            retry_count: retryCount,
            execute_at: nextExecute.toISOString(),
            error: message,
          })
          .eq('id', job.id)
      } else {
        await supabaseAdmin
          .from('job_queue')
          .update({
            status: 'failed',
            retry_count: retryCount,
            error: message,
            completed_at: new Date().toISOString(),
          })
          .eq('id', job.id)
      }
      failed++
    }
  }

  return { processed: jobs.length, succeeded, failed }
}

async function handleJob(job: Record<string, unknown>): Promise<void> {
  const payload = job.payload as Record<string, unknown>

  switch (job.job_type) {
    case 'email_campaign_send':
      await handleEmailCampaignSend(payload)
      break
    case 'sms_campaign_send':
      await handleSmsCampaignSend(payload)
      break
    case 'automation_step':
      await handleAutomationStep(payload)
      break
    case 'social_post_publish':
      await handleSocialPostPublish(payload)
      break
    case 'token_refresh':
      await handleTokenRefresh(payload)
      break
    case 'segment_recount':
      await handleSegmentRecount(payload)
      break
    case 'engagement_fetch':
      // Placeholder - fetch engagement metrics
      break
    default:
      throw new Error(`Unknown job type: ${job.job_type}`)
  }
}

async function handleEmailCampaignSend(payload: Record<string, unknown>): Promise<void> {
  const campaignId = payload.campaign_id as string
  const workspaceId = payload.workspace_id as string
  const batchOffset = (payload.batch_offset as number) || 0

  // 1. Load campaign
  const { data: campaign } = await supabaseAdmin
    .from('email_campaigns')
    .select('*')
    .eq('id', campaignId)
    .single()

  if (!campaign) throw new Error(`Campaign not found: ${campaignId}`)
  if (campaign.status !== 'sending') return // Skip if not in sending state

  // 2. Load workspace for SendGrid config
  const { data: workspace } = await supabaseAdmin
    .from('workspaces')
    .select('sendgrid_from_email, sendgrid_from_name, settings')
    .eq('id', workspaceId)
    .single()

  // 3. If batch_offset === 0, this is the first batch
  if (batchOffset === 0) {
    // a. Resolve recipients based on campaign settings
    let contactQuery = supabaseAdmin
      .from('contacts')
      .select('id, email')
      .eq('workspace_id', workspaceId)
      .eq('status', 'active')
      .eq('email_status', 'active')
      .not('email', 'is', null)

    // Filter by tags if specified
    if (campaign.tag_ids && (campaign.tag_ids as string[]).length > 0) {
      const { data: tagged } = await supabaseAdmin
        .from('contact_tags')
        .select('contact_id')
        .in('tag_id', campaign.tag_ids as string[])
      if (tagged?.length) {
        const ids = Array.from(new Set(tagged.map((t: { contact_id: string }) => t.contact_id)))
        contactQuery = contactQuery.in('id', ids)
      } else {
        // No contacts matched tags
        await supabaseAdmin.from('email_campaigns').update({
          status: 'sent', total_recipients: 0, completed_at: new Date().toISOString()
        }).eq('id', campaignId)
        return
      }
    }

    // Exclude contacts with specific tags
    if (campaign.exclude_tag_ids && (campaign.exclude_tag_ids as string[]).length > 0) {
      const { data: excluded } = await supabaseAdmin
        .from('contact_tags')
        .select('contact_id')
        .in('tag_id', campaign.exclude_tag_ids as string[])
      if (excluded?.length) {
        const excludeIds = Array.from(new Set(excluded.map((t: { contact_id: string }) => t.contact_id)))
        contactQuery = contactQuery.not('id', 'in', `(${excludeIds.join(',')})`)
      }
    }

    // Exclude globally suppressed emails
    const { data: suppressed } = await supabaseAdmin
      .from('global_suppression')
      .select('email')
      .not('email', 'is', null)
    const suppressedEmails = (suppressed || []).map((s: { email: string | null }) => s.email).filter(Boolean) as string[]

    const { data: recipients } = await contactQuery
    const filteredRecipients = (recipients || []).filter(
      (r: { email: string | null }) => r.email && !suppressedEmails.includes(r.email)
    )

    if (filteredRecipients.length === 0) {
      await supabaseAdmin.from('email_campaigns').update({
        status: 'sent', total_recipients: 0, started_at: new Date().toISOString(), completed_at: new Date().toISOString()
      }).eq('id', campaignId)
      return
    }

    // b. Set total_recipients
    await supabaseAdmin.from('email_campaigns').update({
      total_recipients: filteredRecipients.length,
      started_at: new Date().toISOString(),
    }).eq('id', campaignId)

    // c. Batch insert email_sends
    const sendRows = filteredRecipients.map((r: { id: string }) => ({
      campaign_id: campaignId,
      contact_id: r.id,
      workspace_id: workspaceId,
      idempotency_key: `${campaignId}:${r.id}`,
      status: 'queued',
    }))

    // Insert in batches of 500
    for (let i = 0; i < sendRows.length; i += 500) {
      const batch = sendRows.slice(i, i + 500)
      await supabaseAdmin.from('email_sends').upsert(batch, { onConflict: 'idempotency_key' })
    }
  }

  // 4. Get next 50 queued sends
  const { data: sends } = await supabaseAdmin
    .from('email_sends')
    .select('id, contact_id')
    .eq('campaign_id', campaignId)
    .eq('status', 'queued')
    .order('created_at', { ascending: true })
    .limit(50)

  // 5. If none left, mark campaign as sent
  if (!sends || sends.length === 0) {
    await supabaseAdmin.from('email_campaigns').update({
      status: 'sent',
      completed_at: new Date().toISOString(),
    }).eq('id', campaignId)
    return
  }

  // 6. Process each send
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const { personalizeContent } = await import('@/lib/utils/merge-tags')
  const { htmlToPlainText } = await import('@/lib/utils/merge-tags')

  for (const send of sends) {
    try {
      // a. Load contact
      const { data: contact } = await supabaseAdmin
        .from('contacts')
        .select('*')
        .eq('id', send.contact_id)
        .single()

      if (!contact || !contact.email) {
        await supabaseAdmin.from('email_sends').update({
          status: 'failed', error_message: 'Contact not found or no email'
        }).eq('id', send.id)
        continue
      }

      // b-d. Personalize content with tracking
      const unsubscribeUrl = `${baseUrl}/api/unsubscribe?id=${send.id}`
      const personalizedHtml = personalizeContent(
        campaign.html_body as string,
        contact,
        send.id,
        unsubscribeUrl
      )

      const personalizedSubject = replaceMergeTags(
        campaign.subject as string,
        contact,
        { unsubscribe_url: unsubscribeUrl }
      )

      const personalizedText = campaign.text_body
        ? replaceMergeTags(campaign.text_body as string, contact, { unsubscribe_url: unsubscribeUrl })
        : htmlToPlainText(personalizedHtml)

      // e. Send via SendGrid
      const result = await sendEmail({
        to: contact.email as string,
        from: (campaign.from_email as string) || workspace?.sendgrid_from_email || 'noreply@app.blastoff.io',
        fromName: (campaign.from_name as string) || workspace?.sendgrid_from_name || 'Blastoff',
        subject: personalizedSubject,
        html: personalizedHtml,
        text: personalizedText,
        replyTo: campaign.reply_to as string | undefined,
        customArgs: { send_id: send.id },
      })

      // f. Update email_sends
      await supabaseAdmin.from('email_sends').update({
        sendgrid_message_id: result.messageId,
        status: 'sent',
        sent_at: new Date().toISOString(),
      }).eq('id', send.id)

      // g. Increment campaign total_sent
      const { data: currentCampaign } = await supabaseAdmin
        .from('email_campaigns')
        .select('total_sent')
        .eq('id', campaignId)
        .single()
      if (currentCampaign) {
        await supabaseAdmin.from('email_campaigns').update({
          total_sent: (currentCampaign.total_sent as number) + 1,
        }).eq('id', campaignId)
      }

      // h. Update contact last_contacted_at
      await supabaseAdmin.from('contacts').update({
        last_contacted_at: new Date().toISOString(),
      }).eq('id', send.contact_id)

      // i. Log activity
      await supabaseAdmin.from('contact_activities').insert({
        workspace_id: workspaceId,
        contact_id: send.contact_id,
        activity_type: 'email_sent',
        metadata: { campaign_id: campaignId, subject: personalizedSubject },
      })

    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Send failed'
      await supabaseAdmin.from('email_sends').update({
        status: 'failed',
        error_message: message,
      }).eq('id', send.id)
    }
  }

  // 7. Enqueue next batch
  await enqueueJob({
    workspaceId,
    type: 'email_campaign_send',
    payload: { campaign_id: campaignId, workspace_id: workspaceId, batch_offset: batchOffset + 50 },
    priority: 1,
  })
}

async function handleSmsCampaignSend(payload: Record<string, unknown>): Promise<void> {
  const campaignId = payload.campaign_id as string
  const workspaceId = payload.workspace_id as string
  const batchOffset = (payload.batch_offset as number) || 0

  // 1. Load campaign
  const { data: campaign } = await supabaseAdmin
    .from('sms_campaigns')
    .select('*')
    .eq('id', campaignId)
    .single()

  if (!campaign) throw new Error(`SMS Campaign not found: ${campaignId}`)
  if (campaign.status !== 'sending') return

  // 2. Load workspace for Twilio config
  const { data: workspace } = await supabaseAdmin
    .from('workspaces')
    .select('twilio_phone_number, settings')
    .eq('id', workspaceId)
    .single()

  const fromNumber = (campaign.from_number as string) ||
    workspace?.twilio_phone_number ||
    process.env.TWILIO_PHONE_NUMBER || ''

  // 3. If batch_offset === 0, this is the first batch - resolve recipients
  if (batchOffset === 0) {
    let contactQuery = supabaseAdmin
      .from('contacts')
      .select('id, phone')
      .eq('workspace_id', workspaceId)
      .eq('status', 'active')
      .eq('sms_status', 'active')
      .not('phone', 'is', null)

    // Filter by tags if specified
    if (campaign.tag_ids && (campaign.tag_ids as string[]).length > 0) {
      const { data: tagged } = await supabaseAdmin
        .from('contact_tags')
        .select('contact_id')
        .in('tag_id', campaign.tag_ids as string[])
      if (tagged?.length) {
        const ids = Array.from(new Set(tagged.map((t: { contact_id: string }) => t.contact_id)))
        contactQuery = contactQuery.in('id', ids)
      } else {
        await supabaseAdmin.from('sms_campaigns').update({
          status: 'sent', total_recipients: 0, completed_at: new Date().toISOString()
        }).eq('id', campaignId)
        return
      }
    }

    // Exclude contacts with specific tags
    if (campaign.exclude_tag_ids && (campaign.exclude_tag_ids as string[]).length > 0) {
      const { data: excluded } = await supabaseAdmin
        .from('contact_tags')
        .select('contact_id')
        .in('tag_id', campaign.exclude_tag_ids as string[])
      if (excluded?.length) {
        const excludeIds = Array.from(new Set(excluded.map((t: { contact_id: string }) => t.contact_id)))
        contactQuery = contactQuery.not('id', 'in', `(${excludeIds.join(',')})`)
      }
    }

    // Exclude globally suppressed phones
    const { data: suppressed } = await supabaseAdmin
      .from('global_suppression')
      .select('phone')
      .not('phone', 'is', null)
    const suppressedPhones = (suppressed || []).map((s: { phone: string | null }) => s.phone).filter(Boolean) as string[]

    const { data: recipients } = await contactQuery
    const filteredRecipients = (recipients || []).filter(
      (r: { phone: string | null }) => r.phone && !suppressedPhones.includes(normalizePhone(r.phone))
    )

    if (filteredRecipients.length === 0) {
      await supabaseAdmin.from('sms_campaigns').update({
        status: 'sent', total_recipients: 0, started_at: new Date().toISOString(), completed_at: new Date().toISOString()
      }).eq('id', campaignId)
      return
    }

    // Calculate segment count per message for cost estimation
    const segInfo = calculateSMSSegments(campaign.body as string)

    // Set total_recipients and estimated cost
    await supabaseAdmin.from('sms_campaigns').update({
      total_recipients: filteredRecipients.length,
      estimated_cost: filteredRecipients.length * segInfo.segmentCount * COST_PER_SEGMENT,
      started_at: new Date().toISOString(),
    }).eq('id', campaignId)

    // Batch insert sms_sends
    const sendRows = filteredRecipients.map((r: { id: string; phone: string }) => ({
      campaign_id: campaignId,
      contact_id: r.id,
      workspace_id: workspaceId,
      to_number: normalizePhone(r.phone),
      from_number: fromNumber,
      body: campaign.body as string,
      idempotency_key: `${campaignId}:${r.id}`,
      status: 'queued',
      segments: segInfo.segmentCount,
    }))

    for (let i = 0; i < sendRows.length; i += 500) {
      const batch = sendRows.slice(i, i + 500)
      await supabaseAdmin.from('sms_sends').upsert(batch, { onConflict: 'idempotency_key' })
    }
  }

  // 4. Get next 20 queued sends (batch size 20 for SMS, respecting rate limits)
  const { data: sends } = await supabaseAdmin
    .from('sms_sends')
    .select('id, contact_id, to_number, body')
    .eq('campaign_id', campaignId)
    .eq('status', 'queued')
    .order('created_at', { ascending: true })
    .limit(20)

  // 5. If none left, mark campaign as sent
  if (!sends || sends.length === 0) {
    await supabaseAdmin.from('sms_campaigns').update({
      status: 'sent',
      completed_at: new Date().toISOString(),
    }).eq('id', campaignId)
    return
  }

  // 6. Process each send
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

  for (const send of sends) {
    try {
      // Check if campaign was paused (e.g., by webhook carrier violation)
      if (sends.indexOf(send) > 0 && sends.indexOf(send) % 10 === 0) {
        const { data: freshCampaign } = await supabaseAdmin
          .from('sms_campaigns')
          .select('status')
          .eq('id', campaignId)
          .single()
        if (freshCampaign?.status !== 'sending') return
      }

      // Load contact for merge tag replacement
      const { data: contact } = await supabaseAdmin
        .from('contacts')
        .select('*')
        .eq('id', send.contact_id)
        .single()

      if (!contact || !contact.phone) {
        await supabaseAdmin.from('sms_sends').update({
          status: 'failed', error_message: 'Contact not found or no phone'
        }).eq('id', send.id)
        continue
      }

      // Personalize body with merge tags
      const personalizedBody = replaceMergeTags(
        send.body as string,
        contact,
        {}
      )

      // Calculate actual segments for personalized body
      const segInfo = calculateSMSSegments(personalizedBody)

      // Send via Twilio
      const result = await sendSMS({
        to: send.to_number as string,
        body: personalizedBody,
        from: fromNumber,
        workspaceId,
        sendId: send.id as string,
        statusCallbackUrl: `${baseUrl}/api/webhooks/twilio?send_id=${send.id}`,
      })

      if (result.errorCode) {
        // Handle specific Twilio errors
        await supabaseAdmin.from('sms_sends').update({
          status: 'failed',
          twilio_sid: result.sid || null,
          error_code: result.errorCode,
          error_message: result.errorMessage,
          segments: segInfo.segmentCount,
          cost: 0,
        }).eq('id', send.id)

        // Update campaign failed count
        const { data: currentCampaign } = await supabaseAdmin
          .from('sms_campaigns')
          .select('total_failed')
          .eq('id', campaignId)
          .single()
        if (currentCampaign) {
          await supabaseAdmin.from('sms_campaigns').update({
            total_failed: (currentCampaign.total_failed as number) + 1,
          }).eq('id', campaignId)
        }

        // Handle STOP (21610) - mark contact as stopped
        if (result.errorCode === TWILIO_ERRORS.STOP_MESSAGE) {
          await supabaseAdmin.from('contacts').update({
            sms_status: 'stopped',
          }).eq('id', send.contact_id)
        }

        // Carrier violation (30007) - pause campaign immediately
        if (result.errorCode === TWILIO_ERRORS.CARRIER_VIOLATION) {
          await supabaseAdmin.from('sms_campaigns').update({
            status: 'paused',
          }).eq('id', campaignId)
          return // Stop processing this batch
        }

        continue
      }

      // Success - update sms_send
      const cost = segInfo.segmentCount * COST_PER_SEGMENT
      await supabaseAdmin.from('sms_sends').update({
        twilio_sid: result.sid,
        status: 'sent',
        sent_at: new Date().toISOString(),
        segments: segInfo.segmentCount,
        cost,
      }).eq('id', send.id)

      // Increment campaign total_sent and total_segments_used
      const { data: currentCampaign } = await supabaseAdmin
        .from('sms_campaigns')
        .select('total_sent, total_segments_used')
        .eq('id', campaignId)
        .single()
      if (currentCampaign) {
        await supabaseAdmin.from('sms_campaigns').update({
          total_sent: (currentCampaign.total_sent as number) + 1,
          total_segments_used: (currentCampaign.total_segments_used as number) + segInfo.segmentCount,
        }).eq('id', campaignId)
      }

      // Update contact last_contacted_at
      await supabaseAdmin.from('contacts').update({
        last_contacted_at: new Date().toISOString(),
      }).eq('id', send.contact_id)

      // Log activity
      await supabaseAdmin.from('contact_activities').insert({
        workspace_id: workspaceId,
        contact_id: send.contact_id,
        activity_type: 'sms_sent',
        metadata: { campaign_id: campaignId, segments: segInfo.segmentCount },
      })

    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Send failed'
      await supabaseAdmin.from('sms_sends').update({
        status: 'failed',
        error_message: message,
      }).eq('id', send.id)
    }
  }

  // 7. Enqueue next batch with 22-second delay (respects ~1 msg/sec rate limit for 20 msgs)
  await enqueueJob({
    workspaceId,
    type: 'sms_campaign_send',
    payload: { campaign_id: campaignId, workspace_id: workspaceId, batch_offset: batchOffset + 20 },
    executeAt: new Date(Date.now() + 22_000),
    priority: 1,
  })
}

async function handleAutomationStep(payload: Record<string, unknown>): Promise<void> {
  const runId = (payload.run_id || payload.automationRunId) as string
  const stepIndex = (payload.step_index ?? payload.stepIndex) as number
  const workspaceId = (payload.workspace_id || payload.workspaceId) as string
  const chainDepth = (payload._chain_depth as number) || 0

  // Support branch steps stored in payload (condition branching)
  const branchSteps = payload._branch_steps as Record<string, unknown>[] | undefined

  const { data: run } = await supabaseAdmin
    .from('automation_runs')
    .select('*, automation:automations(*)')
    .eq('id', runId)
    .single()

  if (!run) throw new Error(`Automation run not found: ${runId}`)
  if (run.status === 'cancelled' || run.status === 'completed') return

  const automation = run.automation as Record<string, unknown>
  const steps = branchSteps || (automation?.steps as Record<string, unknown>[]) || []

  // Update current step
  await supabaseAdmin
    .from('automation_runs')
    .update({ current_step: stepIndex, status: 'running' })
    .eq('id', runId)

  if (stepIndex >= steps.length) {
    await supabaseAdmin
      .from('automation_runs')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('id', runId)
    return
  }

  const step = steps[stepIndex]
  const contactId = run.contact_id as string

  const { data: contact } = await supabaseAdmin
    .from('contacts')
    .select('*')
    .eq('id', contactId)
    .single()

  if (!contact) {
    await supabaseAdmin
      .from('automation_runs')
      .update({ status: 'failed', error: 'Contact not found', completed_at: new Date().toISOString() })
      .eq('id', runId)
    return
  }

  // Log step start
  try {
    await supabaseAdmin.from('automation_run_logs').insert({
      run_id: runId,
      step_index: stepIndex,
      step_type: step.type as string,
      status: 'executing',
    })
  } catch {
    // Non-critical — table may not exist yet
  }

  try {
    let shouldAdvance = true

    switch (step.type) {
      // ─── SEND EMAIL ───────────────────────────────────────────────
      case 'send_email': {
        if (!contact.email) {
          await logStepResult(runId, stepIndex, 'skipped', 'No email on contact')
          break
        }

        const { data: ws } = await supabaseAdmin
          .from('workspaces')
          .select('sendgrid_from_email, sendgrid_from_name')
          .eq('id', workspaceId)
          .single()

        const subject = replaceMergeTags((step.subject as string) || '', contact, {})
        const html = replaceMergeTags((step.html_body as string) || (step.html_content as string) || '', contact, {})

        await sendEmail({
          to: contact.email as string,
          from: (step.from_email as string) || ws?.sendgrid_from_email || 'noreply@app.blastoff.io',
          fromName: (step.from_name as string) || ws?.sendgrid_from_name || 'Blastoff',
          subject,
          html,
        })

        await supabaseAdmin.from('contact_activities').insert({
          workspace_id: workspaceId,
          contact_id: contactId,
          activity_type: 'email_sent',
          metadata: { automation_id: automation.id, step_index: stepIndex, subject },
        })
        await logStepResult(runId, stepIndex, 'completed')
        break
      }

      // ─── SEND SMS ─────────────────────────────────────────────────
      case 'send_sms': {
        if (!contact.phone) {
          await logStepResult(runId, stepIndex, 'skipped', 'No phone on contact')
          break
        }
        const smsBody = replaceMergeTags((step.message as string) || (step.body as string) || '', contact, {})
        await sendSMS({
          to: contact.phone as string,
          body: smsBody,
          workspaceId,
        })
        await supabaseAdmin.from('contact_activities').insert({
          workspace_id: workspaceId,
          contact_id: contactId,
          activity_type: 'sms_sent',
          metadata: { automation_id: automation.id, step_index: stepIndex },
        })
        await logStepResult(runId, stepIndex, 'completed')
        break
      }

      // ─── WAIT ─────────────────────────────────────────────────────
      case 'wait': {
        const { parseDuration } = await import('@/lib/services/events')
        const durationStr = (step.duration as string) || '1h'
        const delayMs = parseDuration(durationStr)
        const nextExecute = new Date(Date.now() + delayMs)

        await supabaseAdmin
          .from('automation_runs')
          .update({ status: 'waiting' })
          .eq('id', runId)

        await enqueueJob({
          workspaceId,
          type: 'automation_step',
          payload: {
            run_id: runId,
            step_index: stepIndex + 1,
            workspace_id: workspaceId,
            _chain_depth: chainDepth,
            ...(branchSteps ? { _branch_steps: branchSteps } : {}),
          },
          executeAt: nextExecute,
          idempotencyKey: `auto_${runId}_step_${stepIndex + 1}`,
        })

        await logStepResult(runId, stepIndex, 'completed', `Waiting ${durationStr}`)
        shouldAdvance = false
        break
      }

      // ─── CONDITION ────────────────────────────────────────────────
      case 'condition': {
        const field = step.field as string
        const operator = step.operator as string
        const value = step.value

        const contactValue = field?.startsWith('custom_fields.')
          ? ((contact.custom_fields as Record<string, unknown>) || {})[field.replace('custom_fields.', '')]
          : (contact as Record<string, unknown>)[field]

        let conditionMet = false
        switch (operator) {
          case 'equals': case 'eq':
            conditionMet = String(contactValue) === String(value); break
          case 'not_equals': case 'neq':
            conditionMet = String(contactValue) !== String(value); break
          case 'contains':
            conditionMet = String(contactValue || '').toLowerCase().includes(String(value || '').toLowerCase()); break
          case 'not_contains':
            conditionMet = !String(contactValue || '').toLowerCase().includes(String(value || '').toLowerCase()); break
          case 'exists':
            conditionMet = contactValue !== null && contactValue !== undefined && contactValue !== ''; break
          case 'not_exists':
            conditionMet = contactValue === null || contactValue === undefined || contactValue === ''; break
          case 'gt':
            conditionMet = Number(contactValue) > Number(value); break
          case 'lt':
            conditionMet = Number(contactValue) < Number(value); break
          case 'has_tag': {
            const { data: ht } = await supabaseAdmin
              .from('contact_tags')
              .select('id')
              .eq('contact_id', contactId)
              .eq('tag_id', value as string)
              .maybeSingle()
            conditionMet = !!ht
            break
          }
          default:
            conditionMet = false
        }

        const branchChoice = conditionMet
          ? (step.yes_steps as Record<string, unknown>[]) || []
          : (step.no_steps as Record<string, unknown>[]) || []

        if (branchChoice.length > 0) {
          // Create a sub-run for the branch
          const { data: subRun } = await supabaseAdmin
            .from('automation_runs')
            .insert({
              automation_id: automation.id,
              contact_id: contactId,
              workspace_id: workspaceId,
              status: 'running',
              trigger_data: { parent_run_id: runId, branch: conditionMet ? 'yes' : 'no' },
              current_step: 0,
            })
            .select('id')
            .single()

          if (subRun) {
            await enqueueJob({
              workspaceId,
              type: 'automation_step',
              payload: {
                run_id: subRun.id,
                step_index: 0,
                workspace_id: workspaceId,
                _chain_depth: chainDepth,
                _branch_steps: branchChoice,
              },
              priority: 2,
              idempotencyKey: `auto_${subRun.id}_step_0`,
            })
          }
        }

        await logStepResult(runId, stepIndex, 'completed', `Condition: ${conditionMet ? 'yes' : 'no'}`)
        break
      }

      // ─── ADD TAG ──────────────────────────────────────────────────
      case 'add_tag': {
        if (!step.tag_id) { await logStepResult(runId, stepIndex, 'skipped', 'No tag_id'); break }
        await supabaseAdmin.from('contact_tags').upsert(
          { contact_id: contactId, tag_id: step.tag_id as string },
          { onConflict: 'contact_id,tag_id' }
        )
        await supabaseAdmin.from('contact_activities').insert({
          workspace_id: workspaceId, contact_id: contactId,
          activity_type: 'tag_added',
          metadata: { tag_id: step.tag_id, automation_id: automation.id },
        })
        await supabaseAdmin.from('event_log').insert({
          workspace_id: workspaceId, event_type: 'tag_added', contact_id: contactId,
          payload: { contact_id: contactId, tag_id: step.tag_id, _chain_depth: chainDepth + 1 },
          processed: false,
        })
        await logStepResult(runId, stepIndex, 'completed')
        break
      }

      // ─── REMOVE TAG ───────────────────────────────────────────────
      case 'remove_tag': {
        if (!step.tag_id) { await logStepResult(runId, stepIndex, 'skipped', 'No tag_id'); break }
        await supabaseAdmin.from('contact_tags').delete()
          .eq('contact_id', contactId).eq('tag_id', step.tag_id as string)
        await supabaseAdmin.from('contact_activities').insert({
          workspace_id: workspaceId, contact_id: contactId,
          activity_type: 'tag_removed',
          metadata: { tag_id: step.tag_id, automation_id: automation.id },
        })
        await supabaseAdmin.from('event_log').insert({
          workspace_id: workspaceId, event_type: 'tag_removed', contact_id: contactId,
          payload: { contact_id: contactId, tag_id: step.tag_id, _chain_depth: chainDepth + 1 },
          processed: false,
        })
        await logStepResult(runId, stepIndex, 'completed')
        break
      }

      // ─── UPDATE FIELD ─────────────────────────────────────────────
      case 'update_field': {
        const fName = step.field as string
        const fValue = step.value
        if (!fName) { await logStepResult(runId, stepIndex, 'skipped', 'No field specified'); break }

        if (fName.startsWith('custom_fields.')) {
          const key = fName.replace('custom_fields.', '')
          const existing = (contact.custom_fields as Record<string, unknown>) || {}
          await supabaseAdmin.from('contacts').update({ custom_fields: { ...existing, [key]: fValue } }).eq('id', contactId)
        } else {
          await supabaseAdmin.from('contacts').update({ [fName]: fValue }).eq('id', contactId)
        }

        await supabaseAdmin.from('contact_activities').insert({
          workspace_id: workspaceId, contact_id: contactId,
          activity_type: 'field_updated',
          metadata: { field: fName, value: fValue, automation_id: automation.id },
        })
        await logStepResult(runId, stepIndex, 'completed')
        break
      }

      // ─── WEBHOOK ──────────────────────────────────────────────────
      case 'webhook': {
        const whUrl = step.url as string
        if (!whUrl) { await logStepResult(runId, stepIndex, 'skipped', 'No URL'); break }

        const ctrl = new AbortController()
        const timer = setTimeout(() => ctrl.abort(), 10_000)

        try {
          const resp = await fetch(whUrl, {
            method: (step.method as string) || 'POST',
            headers: { 'Content-Type': 'application/json', ...(step.headers as Record<string, string> || {}) },
            body: JSON.stringify({
              contact_id: contactId, contact_email: contact.email, contact_phone: contact.phone,
              contact_first_name: contact.first_name, contact_last_name: contact.last_name,
              automation_id: automation.id, run_id: runId, step_index: stepIndex,
              custom_data: step.custom_data || {},
            }),
            signal: ctrl.signal,
          })
          if (!resp.ok) throw new Error(`Webhook returned ${resp.status}`)
          await logStepResult(runId, stepIndex, 'completed', `HTTP ${resp.status}`)
        } catch (whErr) {
          await logStepResult(runId, stepIndex, 'failed', whErr instanceof Error ? whErr.message : 'Webhook failed')
        } finally {
          clearTimeout(timer)
        }
        break
      }

      // ─── NOTIFY ───────────────────────────────────────────────────
      case 'notify': {
        const notifMsg = replaceMergeTags((step.message as string) || 'Automation notification', contact, {})
        try {
          await supabaseAdmin.from('notifications').insert({
            workspace_id: workspaceId,
            title: (step.title as string) || 'Automation Alert',
            message: notifMsg,
            type: 'automation',
            metadata: { automation_id: automation.id, run_id: runId, contact_id: contactId },
          })
        } catch {
          // notifications table may not exist — non-critical
        }
        await logStepResult(runId, stepIndex, 'completed')
        break
      }

      default:
        await logStepResult(runId, stepIndex, 'skipped', `Unknown step type: ${step.type}`)
    }

    if (shouldAdvance) {
      const nextStep = stepIndex + 1
      if (nextStep < steps.length) {
        await enqueueJob({
          workspaceId,
          type: 'automation_step',
          payload: {
            run_id: runId, step_index: nextStep, workspace_id: workspaceId,
            _chain_depth: chainDepth,
            ...(branchSteps ? { _branch_steps: branchSteps } : {}),
          },
          priority: 2,
          idempotencyKey: `auto_${runId}_step_${nextStep}`,
        })
      } else {
        await supabaseAdmin.from('automation_runs')
          .update({ status: 'completed', completed_at: new Date().toISOString() })
          .eq('id', runId)
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Step execution failed'
    await logStepResult(runId, stepIndex, 'failed', message)
    await supabaseAdmin.from('automation_runs')
      .update({ status: 'failed', error: message, completed_at: new Date().toISOString() })
      .eq('id', runId)
    throw err
  }
}

async function logStepResult(runId: string, stepIndex: number, status: string, message?: string): Promise<void> {
  try {
    await supabaseAdmin.from('automation_run_logs')
      .update({ status, message: message || null, completed_at: new Date().toISOString() })
      .eq('run_id', runId).eq('step_index', stepIndex).eq('status', 'executing')
  } catch {
    // Non-critical
  }
}

async function handleSocialPostPublish(payload: Record<string, unknown>): Promise<void> {
  const postId = payload.postId as string

  const { data: post } = await supabaseAdmin
    .from('social_posts')
    .select('*')
    .eq('id', postId)
    .single()

  if (!post) throw new Error(`Social post not found: ${postId}`)

  await supabaseAdmin
    .from('social_posts')
    .update({ status: 'publishing' })
    .eq('id', postId)

  // Get accounts for this post
  const { data: accounts } = await supabaseAdmin
    .from('social_accounts')
    .select('*')
    .eq('workspace_id', post.workspace_id)

  if (!accounts?.length) {
    await supabaseAdmin.from('social_posts').update({ status: 'failed' }).eq('id', postId)
    return
  }

  let published = false
  for (const account of accounts) {
    try {
      switch (account.platform) {
        case 'facebook':
          await publishToFacebook({
            pageId: account.platform_id as string,
            accessToken: account.access_token as string,
            message: post.content as string,
          })
          published = true
          break
        case 'instagram':
          await publishToInstagram({
            accountId: account.platform_id as string,
            accessToken: account.access_token as string,
            message: post.content as string,
            mediaUrl: ((post.media_urls as string[]) || [])[0] || '',
          })
          published = true
          break
        case 'google_business':
          await publishToGBP({
            locationId: account.platform_id as string,
            refreshToken: account.refresh_token as string,
            message: post.content as string,
          })
          published = true
          break
      }
    } catch (err) {
      console.error(`Failed to publish to ${account.platform}:`, err)
    }
  }

  await supabaseAdmin
    .from('social_posts')
    .update({
      status: published ? 'published' : 'failed',
      published_at: published ? new Date().toISOString() : null,
    })
    .eq('id', postId)
}

async function handleTokenRefresh(payload: Record<string, unknown>): Promise<void> {
  const accountId = payload.accountId as string
  const platform = payload.platform as string

  const { data: account } = await supabaseAdmin
    .from('social_accounts')
    .select('*')
    .eq('id', accountId)
    .single()

  if (!account) throw new Error(`Account not found: ${accountId}`)

  let newToken: string
  let expiresAt: Date

  switch (platform) {
    case 'facebook':
    case 'instagram': {
      const result = await refreshMetaToken(account.access_token as string)
      newToken = result.accessToken
      expiresAt = result.expiresAt
      break
    }
    case 'google_business': {
      const result = await refreshGoogleToken(account.refresh_token as string)
      newToken = result.accessToken
      expiresAt = result.expiresAt
      break
    }
    default:
      throw new Error(`Unsupported platform: ${platform}`)
  }

  await supabaseAdmin
    .from('social_accounts')
    .update({ access_token: newToken, token_expires_at: expiresAt.toISOString() })
    .eq('id', accountId)
}

async function handleSegmentRecount(payload: Record<string, unknown>): Promise<void> {
  const segmentId = payload.segmentId as string
  const workspaceId = payload.workspaceId as string

  const { data: segment } = await supabaseAdmin
    .from('segments')
    .select('*')
    .eq('id', segmentId)
    .single()

  if (!segment) throw new Error(`Segment not found: ${segmentId}`)

  const { count } = await supabaseAdmin
    .from('contacts')
    .select('id', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId)
    .eq('status', 'active')

  await supabaseAdmin
    .from('segments')
    .update({
      contact_count: count || 0,
      last_calculated_at: new Date().toISOString(),
    })
    .eq('id', segmentId)
}
