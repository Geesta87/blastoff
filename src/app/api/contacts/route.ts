import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient()
    const { searchParams } = new URL(request.url)

    const workspaceId = searchParams.get('workspace_id')
    if (!workspaceId) {
      return NextResponse.json({ error: 'workspace_id is required' }, { status: 400 })
    }

    const search = searchParams.get('search')
    const status = searchParams.get('status')
    const tagId = searchParams.get('tag_id')
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = parseInt(searchParams.get('limit') || '50', 10)
    const offset = (page - 1) * limit

    let query = supabase
      .from('contacts')
      .select('*', { count: 'exact' })
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })

    if (search) {
      query = query.or(
        `first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%`
      )
    }
    if (status) {
      query = query.eq('status', status)
    }
    if (tagId) {
      const { data: taggedIds } = await supabase
        .from('contact_tags')
        .select('contact_id')
        .eq('tag_id', tagId)
      if (taggedIds && taggedIds.length > 0) {
        query = query.in('id', taggedIds.map((t) => t.contact_id))
      } else {
        return NextResponse.json({ contacts: [], total: 0, page, limit })
      }
    }

    query = query.range(offset, offset + limit - 1)
    const { data: contacts, error, count } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ contacts: contacts || [], total: count || 0, page, limit })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient()
    const body = await request.json()
    const { workspace_id, email, phone, first_name, last_name, source, custom_fields } = body

    if (!workspace_id) {
      return NextResponse.json({ error: 'workspace_id is required' }, { status: 400 })
    }
    if (!email && !phone) {
      return NextResponse.json(
        { error: 'At least one of email or phone is required' },
        { status: 400 }
      )
    }

    const { data: contact, error } = await supabase
      .from('contacts')
      .insert({
        workspace_id,
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

    return NextResponse.json(contact, { status: 201 })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
