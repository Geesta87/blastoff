import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/utils/workspace'

export async function GET() {
  try {
    const workspaceId = await getWorkspaceId()
    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 401 })
    }

    const supabase = await createServerClient()

    const { data: tags, error } = await supabase
      .from('tags')
      .select('*, contact_tags(count)')
      .eq('workspace_id', workspaceId)
      .order('name')

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Transform to include contact_count as a flat number
    const tagsWithCount = (tags || []).map((tag) => {
      const contactTagsArr = tag.contact_tags as unknown as { count: number }[]
      const contactCount =
        contactTagsArr && contactTagsArr.length > 0
          ? contactTagsArr[0].count
          : 0
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { contact_tags: _removed, ...rest } = tag
      return { ...rest, contact_count: contactCount }
    })

    return NextResponse.json(tagsWithCount)
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
    const { name, color } = body

    if (!name) {
      return NextResponse.json({ error: 'Tag name is required' }, { status: 400 })
    }

    const { data: tag, error } = await supabase
      .from('tags')
      .insert({
        workspace_id: workspaceId,
        name,
        color: color || '#6B7280',
      })
      .select()
      .single()

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'Tag already exists' }, { status: 409 })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(tag, { status: 201 })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
