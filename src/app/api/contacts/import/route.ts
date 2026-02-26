import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  const supabase = await createServerClient()
  const body = await request.json()
  const { contacts, workspace_id } = body

  if (!workspace_id || !contacts?.length) {
    return NextResponse.json({ error: 'workspace_id and contacts array required' }, { status: 400 })
  }

  const rows = contacts.map((c: Record<string, unknown>) => ({
    ...c,
    workspace_id,
  }))

  const { data, error } = await supabase
    .from('contacts')
    .upsert(rows, { onConflict: 'workspace_id,email' })
    .select()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ imported: data?.length || 0 })
}
