import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/utils/workspace'
import { buildSegmentQuery } from '@/lib/utils/segment-query-builder'

export async function GET() {
  try {
    const workspaceId = await getWorkspaceId()
    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 401 })
    }

    const supabase = await createServerClient()

    const { data: segments, error } = await supabase
      .from('segments')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(segments || [])
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
    const { name, description, filter_rules, is_dynamic } = body

    if (!name) {
      return NextResponse.json({ error: 'Segment name is required' }, { status: 400 })
    }

    if (!filter_rules) {
      return NextResponse.json({ error: 'filter_rules is required' }, { status: 400 })
    }

    const { data: segment, error } = await supabase
      .from('segments')
      .insert({
        workspace_id: workspaceId,
        name,
        description: description || null,
        filter_rules,
        is_dynamic: is_dynamic ?? true,
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Calculate contact_count using the segment query builder
    const countQuery = buildSegmentQuery(supabase, workspaceId, filter_rules)
    const { count } = await countQuery

    const contactCount = count || 0

    // Update segment with the calculated count
    const { data: updatedSegment, error: updateError } = await supabase
      .from('segments')
      .update({ contact_count: contactCount })
      .eq('id', segment.id)
      .select()
      .single()

    if (updateError) {
      // Return the segment even if count update fails
      return NextResponse.json({ ...segment, contact_count: contactCount }, { status: 201 })
    }

    return NextResponse.json(updatedSegment, { status: 201 })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
