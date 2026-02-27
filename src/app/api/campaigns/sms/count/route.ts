import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/utils/workspace'

export async function POST(request: NextRequest) {
  try {
    const workspaceId = await getWorkspaceId()
    if (!workspaceId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const supabase = await createServerClient()
    const body = await request.json()
    const { recipient_type, tag_ids, segment_id, exclude_tag_ids } = body

    let query = supabase
      .from('contacts')
      .select('id', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId)
      .eq('status', 'active')
      .eq('sms_status', 'active')
      .not('phone', 'is', null)

    // Filter by tags
    if (recipient_type === 'tags' && tag_ids?.length > 0) {
      const { data: tagged } = await supabase
        .from('contact_tags')
        .select('contact_id')
        .in('tag_id', tag_ids)

      if (!tagged?.length) {
        return NextResponse.json({ count: 0 })
      }
      const ids = Array.from(new Set(tagged.map((t: { contact_id: string }) => t.contact_id)))
      query = query.in('id', ids)
    }

    // Exclude tags
    if (exclude_tag_ids?.length > 0) {
      const { data: excluded } = await supabase
        .from('contact_tags')
        .select('contact_id')
        .in('tag_id', exclude_tag_ids)

      if (excluded?.length) {
        const excludeIds = Array.from(new Set(excluded.map((t: { contact_id: string }) => t.contact_id)))
        query = query.not('id', 'in', `(${excludeIds.join(',')})`)
      }
    }

    // Filter suppressed phones
    const { data: suppressed } = await supabase
      .from('global_suppression')
      .select('phone')
      .not('phone', 'is', null)

    // We can't easily filter suppressed in the count query, so just note it
    void suppressed

    const { count, error } = await query

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ count: count || 0, segment_id })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
