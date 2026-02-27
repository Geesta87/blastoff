import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/utils/workspace'

export async function GET() {
  try {
    const workspaceId = await getWorkspaceId()
    if (!workspaceId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const supabase = await createServerClient()

    const { data, error } = await supabase
      .from('sms_campaigns')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
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
    if (!workspaceId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const supabase = await createServerClient()
    const body = await request.json()

    const {
      name,
      body: smsBody,
      from_number,
      template_id,
      segment_id,
      tag_ids,
      exclude_tag_ids,
      status,
      scheduled_at,
      estimated_cost,
    } = body

    if (!name) {
      return NextResponse.json({ error: 'Campaign name is required' }, { status: 400 })
    }

    const insertPayload = {
      workspace_id: workspaceId,
      name,
      body: smsBody || '',
      from_number: from_number || '',
      template_id: template_id || null,
      segment_id: segment_id || null,
      tag_ids: tag_ids || [],
      exclude_tag_ids: exclude_tag_ids || [],
      status: status || 'draft',
      scheduled_at: scheduled_at || null,
      estimated_cost: estimated_cost || 0,
    }

    const { data, error } = await supabase
      .from('sms_campaigns')
      .insert(insertPayload)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data, { status: 201 })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
