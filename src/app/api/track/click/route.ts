import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const sendId = searchParams.get('id')
  const url = searchParams.get('url')

  if (sendId) {
    await supabaseAdmin
      .from('email_sends')
      .update({
        status: 'clicked',
        clicked_at: new Date().toISOString(),
      })
      .eq('id', sendId)
      .is('clicked_at', null)
  }

  if (url) {
    return NextResponse.redirect(url)
  }

  return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 })
}
