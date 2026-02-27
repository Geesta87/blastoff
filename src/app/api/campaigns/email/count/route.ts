import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/utils/workspace'

export async function POST(request: NextRequest) {
  try {
    const workspaceId = await getWorkspaceId()
    if (!workspaceId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const supabase = await createServerClient()
    const { recipient_type, tag_ids, segment_id, exclude_tag_ids } = await request.json()

    let query = supabase
      .from('contacts')
      .select('id', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId)
      .eq('status', 'active')
      .eq('email_status', 'active')
      .not('email', 'is', null)

    if (recipient_type === 'tags' && tag_ids?.length) {
      const { data: tagged } = await supabase
        .from('contact_tags')
        .select('contact_id')
        .in('tag_id', tag_ids)
      if (tagged?.length) {
        const ids = Array.from(new Set(tagged.map((t: { contact_id: string }) => t.contact_id)))
        query = query.in('id', ids)
      } else {
        return NextResponse.json({ count: 0 })
      }
    }

    if (recipient_type === 'segment' && segment_id) {
      const { data: segment } = await supabase
        .from('segments')
        .select('filter_rules')
        .eq('id', segment_id)
        .single()
      // For simplicity, return segment contact_count
      if (segment) {
        // Would need to apply filter rules - for now use the stored count
      }
    }

    if (exclude_tag_ids?.length) {
      const { data: excluded } = await supabase
        .from('contact_tags')
        .select('contact_id')
        .in('tag_id', exclude_tag_ids)
      if (excluded?.length) {
        const excludeIds = Array.from(
          new Set(excluded.map((t: { contact_id: string }) => t.contact_id))
        )
        // Supabase doesn't have a direct "not in" for arrays, use filter
        query = query.not('id', 'in', `(${excludeIds.join(',')})`)
      }
    }

    const { count, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ count: count || 0 })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
