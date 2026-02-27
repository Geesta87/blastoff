import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/utils/workspace'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const workspaceId = await getWorkspaceId()
    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 401 })
    }

    const supabase = await createServerClient()

    const { data: contact, error } = await supabase
      .from('contacts')
      .select('*')
      .eq('id', id)
      .eq('workspace_id', workspaceId)
      .single()

    if (error) {
      return NextResponse.json({ error: 'Contact not found' }, { status: 404 })
    }

    // Fetch tags for this contact
    const { data: contactTags } = await supabase
      .from('contact_tags')
      .select('tag_id, tags(id, name, color, created_at)')
      .eq('contact_id', id)

    const tags = contactTags
      ? contactTags
          .map((ct) => ct.tags)
          .filter(Boolean)
      : []

    return NextResponse.json({ ...contact, tags })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const workspaceId = await getWorkspaceId()
    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 401 })
    }

    const supabase = await createServerClient()
    const body = await request.json()

    // Verify contact belongs to workspace
    const { data: existing, error: fetchError } = await supabase
      .from('contacts')
      .select('id, workspace_id, custom_fields')
      .eq('id', id)
      .eq('workspace_id', workspaceId)
      .single()

    if (fetchError || !existing) {
      return NextResponse.json({ error: 'Contact not found' }, { status: 404 })
    }

    // Build update payload with allowed fields
    const allowedFields = [
      'first_name',
      'last_name',
      'email',
      'phone',
      'status',
      'email_status',
      'sms_status',
      'custom_fields',
      'lead_score',
    ]

    const updateData: Record<string, unknown> = {}
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field]
      }
    }

    // Handle notes stored in custom_fields.notes
    if (body.notes !== undefined) {
      const currentCustomFields =
        (existing.custom_fields as Record<string, unknown>) || {}
      updateData.custom_fields = {
        ...currentCustomFields,
        ...(updateData.custom_fields as Record<string, unknown> || {}),
        notes: body.notes,
      }
    }

    const { data: contact, error } = await supabase
      .from('contacts')
      .update(updateData)
      .eq('id', id)
      .eq('workspace_id', workspaceId)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Log contact activity
    await supabase.from('contact_activities').insert({
      workspace_id: workspaceId,
      contact_id: id,
      activity_type: 'contact_updated',
      metadata: { updated_fields: Object.keys(updateData) },
    })

    return NextResponse.json(contact)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const workspaceId = await getWorkspaceId()
    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 401 })
    }

    const supabase = await createServerClient()

    // Verify contact belongs to workspace
    const { data: existing, error: fetchError } = await supabase
      .from('contacts')
      .select('id')
      .eq('id', id)
      .eq('workspace_id', workspaceId)
      .single()

    if (fetchError || !existing) {
      return NextResponse.json({ error: 'Contact not found' }, { status: 404 })
    }

    // Delete contact (contact_tags and contact_activities cascade)
    const { error } = await supabase
      .from('contacts')
      .delete()
      .eq('id', id)
      .eq('workspace_id', workspaceId)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Log event
    await supabase.from('event_log').insert({
      workspace_id: workspaceId,
      event_type: 'contact_deleted',
      payload: { contact_id: id },
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
