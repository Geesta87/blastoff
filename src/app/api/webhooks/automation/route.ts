import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { enqueueJob } from '@/lib/services/job-queue'

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { webhook_id, contact_id, data: eventData } = body

  if (!webhook_id) {
    return NextResponse.json({ error: 'webhook_id required' }, { status: 400 })
  }

  // Look up the automation webhook
  const { data: webhook, error } = await supabaseAdmin
    .from('automation_webhooks')
    .select('*, automation:automations(*)')
    .eq('id', webhook_id)
    .single()

  if (error || !webhook || !webhook.automation) {
    return NextResponse.json({ error: 'Webhook not found' }, { status: 404 })
  }

  if (webhook.automation.status !== 'active') {
    return NextResponse.json({ error: 'Automation is not active' }, { status: 400 })
  }

  // Create an automation run
  const { data: run, error: runError } = await supabaseAdmin
    .from('automation_runs')
    .insert({
      automation_id: webhook.automation_id,
      contact_id: contact_id || null,
      workspace_id: webhook.automation.workspace_id,
      status: 'running',
      trigger_data: eventData || {},
      current_step: 0,
    })
    .select()
    .single()

  if (runError || !run) {
    return NextResponse.json({ error: 'Failed to create automation run' }, { status: 500 })
  }

  // Enqueue the first step
  await enqueueJob({
    workspaceId: webhook.automation.workspace_id,
    type: 'automation_step',
    payload: {
      automationRunId: run.id,
      stepIndex: 0,
      workspaceId: webhook.automation.workspace_id,
    },
    priority: 2,
    idempotencyKey: `auto_${run.id}_step_0`,
  })

  return NextResponse.json({ success: true, run_id: run.id })
}
