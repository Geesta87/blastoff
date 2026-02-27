import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/utils/workspace'
import { htmlToPlainText } from '@/lib/utils/merge-tags'

export async function GET() {
  try {
    const workspaceId = await getWorkspaceId()
    if (!workspaceId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const supabase = await createServerClient()

    const { data, error } = await supabase
      .from('email_campaigns')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
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
    if (!workspaceId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const supabase = await createServerClient()
    const body = await request.json()

    const {
      name,
      subject,
      from_name,
      from_email,
      reply_to,
      html_body,
      text_body,
      preview_text,
      template_id,
      segment_id,
      tag_ids,
      exclude_tag_ids,
      status,
      scheduled_at,
      total_recipients,
    } = body

    if (!name) {
      return NextResponse.json({ error: 'Campaign name is required' }, { status: 400 })
    }

    // Auto-generate text_body from html_body if not provided
    const finalTextBody = text_body || (html_body ? htmlToPlainText(html_body) : null)

    const insertPayload = {
      workspace_id: workspaceId,
      name,
      subject: subject || '',
      from_name: from_name || 'Blastoff',
      from_email: from_email || '',
      reply_to: reply_to || null,
      html_body: html_body || '',
      text_body: finalTextBody,
      preview_text: preview_text || null,
      template_id: template_id || null,
      segment_id: segment_id || null,
      tag_ids: tag_ids || [],
      exclude_tag_ids: exclude_tag_ids || [],
      status: status || 'draft',
      scheduled_at: scheduled_at || null,
      total_recipients: total_recipients || 0,
    }

    const { data, error } = await supabase
      .from('email_campaigns')
      .insert(insertPayload)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data, { status: 201 })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
