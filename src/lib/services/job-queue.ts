import { supabaseAdmin } from '@/lib/supabase/admin'
import { sendEmail, sendBatchEmails } from '@/lib/services/sendgrid'
import { sendSMS } from '@/lib/services/twilio'
import { publishToFacebook, publishToInstagram, refreshMetaToken } from '@/lib/services/meta'
import { publishToGBP, refreshGoogleToken } from '@/lib/services/google-business'

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
  const campaignId = payload.campaignId as string
  const workspaceId = payload.workspaceId as string

  const { data: campaign } = await supabaseAdmin
    .from('email_campaigns')
    .select('*')
    .eq('id', campaignId)
    .single()

  if (!campaign) throw new Error(`Campaign not found: ${campaignId}`)

  const { data: contacts } = await supabaseAdmin
    .from('contacts')
    .select('id, email, first_name, last_name')
    .eq('workspace_id', workspaceId)
    .eq('status', 'active')
    .not('email', 'is', null)

  if (!contacts?.length) {
    await supabaseAdmin
      .from('email_campaigns')
      .update({ status: 'completed', sent_count: 0 })
      .eq('id', campaignId)
    return
  }

  await supabaseAdmin
    .from('email_campaigns')
    .update({ status: 'sending' })
    .eq('id', campaignId)

  const emailPayloads = contacts.map((contact) => ({
    to: contact.email as string,
    from: (campaign.from_email as string) || `noreply@app.blastoff.io`,
    fromName: campaign.from_name as string | undefined,
    subject: ((campaign.subject as string) || '').replace(/\{\{first_name\}\}/g, (contact.first_name as string) || ''),
    html: ((campaign.html_content as string) || '')
      .replace(/\{\{first_name\}\}/g, (contact.first_name as string) || '')
      .replace(/\{\{last_name\}\}/g, (contact.last_name as string) || ''),
    headers: { 'X-Campaign-Id': campaignId, 'X-Contact-Id': contact.id as string },
  }))

  const result = await sendBatchEmails(emailPayloads)

  await supabaseAdmin
    .from('email_campaigns')
    .update({
      status: 'completed',
      sent_count: result.sent,
      failed_count: result.failed,
      completed_at: new Date().toISOString(),
    })
    .eq('id', campaignId)
}

async function handleSmsCampaignSend(payload: Record<string, unknown>): Promise<void> {
  const campaignId = payload.campaignId as string
  const workspaceId = payload.workspaceId as string

  const { data: campaign } = await supabaseAdmin
    .from('sms_campaigns')
    .select('*')
    .eq('id', campaignId)
    .single()

  if (!campaign) throw new Error(`SMS Campaign not found: ${campaignId}`)

  const { data: contacts } = await supabaseAdmin
    .from('contacts')
    .select('id, phone, first_name, last_name')
    .eq('workspace_id', workspaceId)
    .eq('status', 'active')
    .not('phone', 'is', null)

  if (!contacts?.length) {
    await supabaseAdmin
      .from('sms_campaigns')
      .update({ status: 'completed', sent_count: 0 })
      .eq('id', campaignId)
    return
  }

  await supabaseAdmin
    .from('sms_campaigns')
    .update({ status: 'sending' })
    .eq('id', campaignId)

  let sentCount = 0
  let failedCount = 0

  for (const contact of contacts) {
    try {
      const body = ((campaign.message as string) || '')
        .replace(/\{\{first_name\}\}/g, (contact.first_name as string) || '')
        .replace(/\{\{last_name\}\}/g, (contact.last_name as string) || '')

      await sendSMS({ to: contact.phone as string, body, workspaceId })
      sentCount++
    } catch {
      failedCount++
    }
  }

  await supabaseAdmin
    .from('sms_campaigns')
    .update({
      status: 'completed',
      sent_count: sentCount,
      failed_count: failedCount,
      completed_at: new Date().toISOString(),
    })
    .eq('id', campaignId)
}

async function handleAutomationStep(payload: Record<string, unknown>): Promise<void> {
  const automationRunId = payload.automationRunId as string
  const stepIndex = payload.stepIndex as number
  const workspaceId = payload.workspaceId as string

  const { data: run } = await supabaseAdmin
    .from('automation_runs')
    .select('*, automation:automations(*)')
    .eq('id', automationRunId)
    .single()

  if (!run) throw new Error(`Automation run not found: ${automationRunId}`)
  if (run.status === 'cancelled' || run.status === 'completed') return

  const steps = ((run.automation as Record<string, unknown>)?.steps as Record<string, unknown>[]) || []
  if (stepIndex >= steps.length) {
    await supabaseAdmin
      .from('automation_runs')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('id', automationRunId)
    return
  }

  const step = steps[stepIndex]
  const contactId = run.contact_id as string

  const { data: contact } = await supabaseAdmin
    .from('contacts')
    .select('*')
    .eq('id', contactId)
    .single()

  if (!contact) throw new Error(`Contact not found: ${contactId}`)

  switch (step.type) {
    case 'send_email':
      if (contact.email) {
        await sendEmail({
          to: contact.email as string,
          from: (step.from_email as string) || `noreply@app.blastoff.io`,
          subject: ((step.subject as string) || '').replace(/\{\{first_name\}\}/g, (contact.first_name as string) || ''),
          html: ((step.html_content as string) || '').replace(/\{\{first_name\}\}/g, (contact.first_name as string) || ''),
        })
      }
      break
    case 'send_sms':
      if (contact.phone) {
        await sendSMS({
          to: contact.phone as string,
          body: ((step.message as string) || '').replace(/\{\{first_name\}\}/g, (contact.first_name as string) || ''),
          workspaceId,
        })
      }
      break
    case 'wait': {
      const waitMinutes = (step.duration_minutes as number) || 60
      const nextExecute = new Date(Date.now() + waitMinutes * 60 * 1000)
      await enqueueJob({
        workspaceId,
        type: 'automation_step',
        payload: { automationRunId, stepIndex: stepIndex + 1, workspaceId },
        executeAt: nextExecute,
      })
      return
    }
    case 'add_tag':
      if (step.tag_id) {
        await supabaseAdmin.from('contact_tags').upsert(
          { contact_id: contactId, tag_id: step.tag_id as string, workspace_id: workspaceId },
          { onConflict: 'contact_id,tag_id' }
        )
      }
      break
  }

  // Schedule next step
  const nextStep = stepIndex + 1
  if (nextStep < steps.length) {
    await enqueueJob({
      workspaceId,
      type: 'automation_step',
      payload: { automationRunId, stepIndex: nextStep, workspaceId },
    })
  } else {
    await supabaseAdmin
      .from('automation_runs')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('id', automationRunId)
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
