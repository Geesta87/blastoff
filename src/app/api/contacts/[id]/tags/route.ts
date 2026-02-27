import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/utils/workspace'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: contactId } = await params
    const supabase = await createServerClient()
    const workspaceId = await getWorkspaceId()

    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace not selected' }, { status: 400 })
    }

    const body = await request.json()
    const { tag_id } = body

    if (!tag_id) {
      return NextResponse.json({ error: 'tag_id is required' }, { status: 400 })
    }

    // Upsert the contact-tag relationship
    const { data: contactTag, error } = await supabase
      .from('contact_tags')
      .upsert(
        { contact_id: contactId, tag_id },
        { onConflict: 'contact_id,tag_id' }
      )
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Log contact activity
    await supabase.from('contact_activities').insert({
      workspace_id: workspaceId,
      contact_id: contactId,
      activity_type: 'tag_added',
      metadata: { tag_id },
    })

    // Log event
    await supabase.from('event_log').insert({
      workspace_id: workspaceId,
      event_type: 'tag_added',
      payload: { contact_id: contactId, tag_id },
    })

    return NextResponse.json(contactTag, { status: 201 })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: contactId } = await params
    const supabase = await createServerClient()
    const workspaceId = await getWorkspaceId()

    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace not selected' }, { status: 400 })
    }

    const { searchParams } = new URL(request.url)
    const tagId = searchParams.get('tag_id')

    if (!tagId) {
      return NextResponse.json({ error: 'tag_id is required' }, { status: 400 })
    }

    const { error } = await supabase
      .from('contact_tags')
      .delete()
      .eq('contact_id', contactId)
      .eq('tag_id', tagId)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Log contact activity
    await supabase.from('contact_activities').insert({
      workspace_id: workspaceId,
      contact_id: contactId,
      activity_type: 'tag_removed',
      metadata: { tag_id: tagId },
    })

    // Log event
    await supabase.from('event_log').insert({
      workspace_id: workspaceId,
      event_type: 'tag_removed',
      payload: { contact_id: contactId, tag_id: tagId },
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
