import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  const events = await request.json()

  if (!Array.isArray(events)) {
    return NextResponse.json({ error: 'Expected array of events' }, { status: 400 })
  }

  for (const event of events) {
    const messageId = event.sg_message_id?.split('.')[0]
    if (!messageId) continue

    const statusMap: Record<string, string> = {
      delivered: 'delivered',
      open: 'opened',
      click: 'clicked',
      bounce: 'bounced',
      dropped: 'failed',
      spamreport: 'spam',
      unsubscribe: 'unsubscribed',
    }

    const status = statusMap[event.event]
    if (!status) continue

    const updateData: Record<string, unknown> = { status }
    if (event.event === 'delivered') updateData.delivered_at = new Date(event.timestamp * 1000).toISOString()
    if (event.event === 'open') updateData.opened_at = new Date(event.timestamp * 1000).toISOString()
    if (event.event === 'click') updateData.clicked_at = new Date(event.timestamp * 1000).toISOString()

    await supabaseAdmin
      .from('email_sends')
      .update(updateData)
      .eq('message_id', messageId)
  }

  return NextResponse.json({ success: true })
}
