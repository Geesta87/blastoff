import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const sendId = searchParams.get('id')
  const email = searchParams.get('email')

  if (sendId) {
    // Mark the send as unsubscribed
    const { data: send } = await supabaseAdmin
      .from('email_sends')
      .select('workspace_id, contact_id, to_email, campaign_id')
      .eq('id', sendId)
      .single()

    if (send) {
      // Update contact status
      if (send.contact_id) {
        await supabaseAdmin
          .from('contacts')
          .update({ status: 'unsubscribed' })
          .eq('id', send.contact_id)
      }

      // Log unsubscribe event
      await supabaseAdmin.from('unsubscribe_events').insert({
        workspace_id: send.workspace_id,
        email: send.to_email,
        contact_id: send.contact_id,
        campaign_id: send.campaign_id,
        reason: 'link_click',
      })

      // Add to global suppression
      await supabaseAdmin.from('global_suppression').upsert(
        { workspace_id: send.workspace_id, email: send.to_email, reason: 'unsubscribe' },
        { onConflict: 'workspace_id,email' }
      )
    }
  } else if (email) {
    // Global unsubscribe by email
    await supabaseAdmin
      .from('contacts')
      .update({ status: 'unsubscribed' })
      .eq('email', email)
  }

  // Return a simple HTML page
  return new NextResponse(
    `<!DOCTYPE html>
<html><head><title>Unsubscribed</title></head>
<body style="font-family:sans-serif;text-align:center;padding:60px 20px;">
<h1>You have been unsubscribed</h1>
<p>You will no longer receive emails from us.</p>
</body></html>`,
    { headers: { 'Content-Type': 'text/html' } }
  )
}
