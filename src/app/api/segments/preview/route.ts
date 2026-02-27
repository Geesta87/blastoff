import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/utils/workspace'
import { buildSegmentQuery } from '@/lib/utils/segment-query-builder'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient()
    const workspaceId = await getWorkspaceId()

    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace not selected' }, { status: 400 })
    }

    const body = await request.json()
    const { filter_rules } = body

    if (!filter_rules) {
      return NextResponse.json({ error: 'filter_rules is required' }, { status: 400 })
    }

    const query = buildSegmentQuery(supabase, workspaceId, filter_rules)
    const { count, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ count: count || 0 })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
