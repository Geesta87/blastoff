import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/utils/workspace'

export async function GET() {
  try {
    const workspaceId = await getWorkspaceId()
    if (!workspaceId) return NextResponse.json({ error: 'Workspace not found' }, { status: 401 })

    const supabase = await createServerClient()
    const { data, error } = await supabase
      .from('email_templates')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('is_archived', false)
      .order('updated_at', { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const workspaceId = await getWorkspaceId()
    if (!workspaceId) return NextResponse.json({ error: 'Workspace not found' }, { status: 401 })

    const supabase = await createServerClient()
    const body = await request.json()
    const { name, subject, html_body, text_body, preview_text, variables } = body

    const { data, error } = await supabase
      .from('email_templates')
      .insert({
        workspace_id: workspaceId,
        name: name || 'Untitled Template',
        subject: subject || '',
        html_body: html_body || '',
        text_body: text_body || null,
        preview_text: preview_text || null,
        variables: variables || [],
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Internal server error' }, { status: 500 })
  }
}
