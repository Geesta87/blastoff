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

    const search = searchParams.get('search')
    const status = searchParams.get('status')
    const emailStatus = searchParams.get('email_status')
    const smsStatus = searchParams.get('sms_status')
    const tagIds = searchParams.get('tag_ids')
    const createdAfter = searchParams.get('created_after')
    const sort = searchParams.get('sort') || 'created_at'
    const order = searchParams.get('order') || 'desc'
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = parseInt(searchParams.get('limit') || '25', 10)
    const offset = (page - 1) * limit

    let query = supabase
      .from('contacts')
      .select('*', { count: 'exact' })
      .eq('workspace_id', workspaceId)

    if (search) {
      query = query.or(
        `first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`
      )
    }

    if (status) {
      query = query.eq('status', status)
    }

    if (emailStatus) {
      query = query.eq('email_status', emailStatus)
    }

    if (smsStatus) {
      query = query.eq('sms_status', smsStatus)
    }

    if (tagIds) {
      const tagIdArray = tagIds.split(',').map((id) => id.trim()).filter(Boolean)
      if (tagIdArray.length > 0) {
        const { data: taggedContacts } = await supabase
          .from('contact_tags')
          .select('contact_id')
          .in('tag_id', tagIdArray)

        if (taggedContacts && taggedContacts.length > 0) {
          const contactIds = Array.from(new Set(taggedContacts.map((t) => t.contact_id)))
          query = query.in('id', contactIds)
        } else {
          return NextResponse.json({
            contacts: [],
            total: 0,
            page,
            limit,
            totalPages: 0,
          })
        }
      }
    }

    if (createdAfter) {
      query = query.gte('created_at', createdAfter)
    }

    query = query.order(sort, { ascending: order === 'asc' })
    query = query.range(offset, offset + limit - 1)

    const { data: contacts, error, count } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const total = count || 0

    return NextResponse.json({
      contacts: contacts || [],
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
    const { email, phone, first_name, last_name, source, custom_fields, tag_ids } = body

    if (!email && !phone) {
      return NextResponse.json(
        { error: 'At least one of email or phone is required' },
        { status: 400 }
      )
    }

    const { data: contact, error } = await supabase
      .from('contacts')
      .insert({
        workspace_id: workspaceId,
        email: email || null,
        phone: phone || null,
        first_name: first_name || null,
        last_name: last_name || null,
        source: source || 'manual',
        custom_fields: custom_fields || {},
      })
      .select()
      .single()

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'Contact already exists' }, { status: 409 })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Insert tags if provided
    if (tag_ids && Array.isArray(tag_ids) && tag_ids.length > 0) {
      const tagRows = tag_ids.map((tagId: string) => ({
        contact_id: contact.id,
        tag_id: tagId,
      }))
      await supabase.from('contact_tags').insert(tagRows)
    }

    // Log contact activity
    await supabase.from('contact_activities').insert({
      workspace_id: workspaceId,
      contact_id: contact.id,
      activity_type: 'contact_created',
      metadata: { source: source || 'manual' },
    })

    // Log event
    await supabase.from('event_log').insert({
      workspace_id: workspaceId,
      event_type: 'contact_created',
      payload: { contact_id: contact.id, email, phone },
    })

    return NextResponse.json(contact, { status: 201 })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
