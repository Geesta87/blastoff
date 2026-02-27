import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/utils/workspace'
import { enqueueJob } from '@/lib/services/job-queue'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: automationId } = await params
    const workspaceId = await getWorkspaceId()
    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 401 })
    }

    const supabase = await createServerClient()
    const { searchParams } = new URL(request.url)

    const status = searchParams.get('status')
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = parseInt(searchParams.get('limit') || '25', 10)
    const offset = (page - 1) * limit

    let query = supabase
      .from('automation_runs')
      .select('*, contact:contacts(id, email, first_name, last_name)', { count: 'exact' })
      .eq('automation_id', automationId)
      .eq('workspace_id', workspaceId)

    if (status) query = query.eq('status', status)

    query = query.order('created_at', { ascending: false })
    query = query.range(offset, offset + limit - 1)

    const { data, error, count } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const total = count || 0
    return NextResponse.json({
      runs: data || [],
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

/** Manual enrollment: POST a contact into this automation */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: automationId } = await params
    const workspaceId = await getWorkspaceId()
    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 401 })
    }

    const supabase = await createServerClient()
    const body = await request.json()
    const { contact_id } = body

    if (!contact_id) {
      return NextResponse.json({ error: 'contact_id is required' }, { status: 400 })
    }

    // Verify automation exists and is active
    const { data: automation } = await supabase
      .from('automations')
      .select('id, status, steps, allow_re_entry')
      .eq('id', automationId)
      .eq('workspace_id', workspaceId)
      .single()

    if (!automation) {
      return NextResponse.json({ error: 'Automation not found' }, { status: 404 })
    }
    if (automation.status !== 'active') {
      return NextResponse.json({ error: 'Automation is not active' }, { status: 400 })
    }

    // Check if contact is already enrolled
    const { data: existingRun } = await supabase
      .from('automation_runs')
      .select('id')
      .eq('automation_id', automationId)
      .eq('contact_id', contact_id)
      .in('status', ['running', 'waiting'])
      .maybeSingle()

    if (existingRun) {
      return NextResponse.json({ error: 'Contact is already enrolled in this automation' }, { status: 409 })
    }

    // Check re-entry if not allowed
    if (!automation.allow_re_entry) {
      const { data: pastRun } = await supabase
        .from('automation_runs')
        .select('id')
        .eq('automation_id', automationId)
        .eq('contact_id', contact_id)
        .maybeSingle()

      if (pastRun) {
        return NextResponse.json({ error: 'Contact has already been through this automation' }, { status: 409 })
      }
    }

    const steps = (automation.steps as Record<string, unknown>[]) || []
    if (steps.length === 0) {
      return NextResponse.json({ error: 'Automation has no steps' }, { status: 400 })
    }

    // Create run
    const { data: run, error: runError } = await supabase
      .from('automation_runs')
      .insert({
        automation_id: automationId,
        contact_id,
        workspace_id: workspaceId,
        status: 'running',
        trigger_data: { source: 'manual_enrollment' },
        current_step: 0,
      })
      .select()
      .single()

    if (runError || !run) {
      return NextResponse.json({ error: 'Failed to create run' }, { status: 500 })
    }

    // Enqueue first step
    await enqueueJob({
      workspaceId,
      type: 'automation_step',
      payload: {
        run_id: run.id,
        step_index: 0,
        workspace_id: workspaceId,
      },
      priority: 2,
      idempotencyKey: `auto_${run.id}_step_0`,
    })

    return NextResponse.json(run, { status: 201 })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
