import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/utils/workspace'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient()
    const workspaceId = await getWorkspaceId()

    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace not selected' }, { status: 400 })
    }

    const { searchParams } = new URL(request.url)
    const ids = searchParams.get('ids')
    const status = searchParams.get('status')
    const tagId = searchParams.get('tag_id')

    let query = supabase
      .from('contacts')
      .select('first_name, last_name, email, phone, status, source, created_at')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })

    // Filter by specific contact IDs
    if (ids) {
      const idList = ids.split(',').map((id) => id.trim())
      query = query.in('id', idList)
    }

    // Filter by status
    if (status) {
      query = query.eq('status', status)
    }

    // Filter by tag
    if (tagId) {
      const { data: taggedIds } = await supabase
        .from('contact_tags')
        .select('contact_id')
        .eq('tag_id', tagId)

      if (taggedIds && taggedIds.length > 0) {
        query = query.in('id', taggedIds.map((t) => t.contact_id))
      } else {
        // No contacts with this tag — return empty CSV
        const csv = 'First Name,Last Name,Email,Phone,Status,Source,Created At\n'
        return new NextResponse(csv, {
          status: 200,
          headers: {
            'Content-Type': 'text/csv',
            'Content-Disposition': 'attachment; filename="contacts-export.csv"',
          },
        })
      }
    }

    const { data: contacts, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Build CSV
    const headers = 'First Name,Last Name,Email,Phone,Status,Source,Created At'
    const rows = (contacts || []).map((c) => {
      const fields = [
        escapeCsvField(c.first_name || ''),
        escapeCsvField(c.last_name || ''),
        escapeCsvField(c.email || ''),
        escapeCsvField(c.phone || ''),
        escapeCsvField(c.status || ''),
        escapeCsvField(c.source || ''),
        escapeCsvField(c.created_at || ''),
      ]
      return fields.join(',')
    })

    const csv = [headers, ...rows].join('\n')

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename="contacts-export.csv"',
      },
    })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

function escapeCsvField(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}
