import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/utils/workspace'

export async function GET(request: NextRequest) {
  try {
    const workspaceId = await getWorkspaceId()
    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 401 })
    }

    const supabase = await createServerClient()
    const { searchParams } = new URL(request.url)

    const status = searchParams.get('status')
    const triggerType = searchParams.get('trigger_type')
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = parseInt(searchParams.get('limit') || '25', 10)
    const offset = (page - 1) * limit

    let query = supabase
      .from('automations')
      .select('*', { count: 'exact' })
      .eq('workspace_id', workspaceId)

    if (status) query = query.eq('status', status)
    if (triggerType) query = query.eq('trigger_type', triggerType)

    query = query.order('created_at', { ascending: false })
    query = query.range(offset, offset + limit - 1)

    const { data, error, count } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Get run counts for each automation
    const automationIds = (data || []).map((a) => a.id)
    const runCounts: Record<string, { total: number; active: number }> = {}

    if (automationIds.length > 0) {
      const { data: runs } = await supabase
        .from('automation_runs')
        .select('automation_id, status')
        .in('automation_id', automationIds)

      if (runs) {
        for (const r of runs) {
          const aid = r.automation_id as string
          if (!runCounts[aid]) runCounts[aid] = { total: 0, active: 0 }
          runCounts[aid].total++
          if (r.status === 'running' || r.status === 'waiting') {
            runCounts[aid].active++
          }
        }
      }
    }

    const automations = (data || []).map((a) => ({
      ...a,
      total_runs: runCounts[a.id]?.total || 0,
      active_runs: runCounts[a.id]?.active || 0,
    }))

    const total = count || 0
    return NextResponse.json({
      automations,
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

export async function POST(request: NextRequest) {
  try {
    const workspaceId = await getWorkspaceId()
    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 401 })
    }

    const supabase = await createServerClient()
    const body = await request.json()
    const { name, trigger_type, trigger_config, steps, allow_re_entry, re_entry_delay } = body

    if (!name || !trigger_type) {
      return NextResponse.json(
        { error: 'name and trigger_type are required' },
        { status: 400 }
      )
    }

    const { data, error } = await supabase
      .from('automations')
      .insert({
        workspace_id: workspaceId,
        name,
        trigger_type,
        trigger_config: trigger_config || {},
        steps: steps || [],
        status: 'draft',
        allow_re_entry: allow_re_entry ?? false,
        re_entry_delay: re_entry_delay || null,
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data, { status: 201 })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
