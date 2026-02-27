import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const sendId = searchParams.get('id')
  const email = searchParams.get('email')

  let workspaceName = ''

  if (sendId) {
    try {
      const { data: send } = await supabaseAdmin
        .from('email_sends')
        .select('workspace_id, contact_id, campaign_id')
        .eq('id', sendId)
        .single()

      if (send) {
        // Get workspace name
        const { data: ws } = await supabaseAdmin
          .from('workspaces')
          .select('name')
          .eq('id', send.workspace_id)
          .single()
        workspaceName = ws?.name || ''

        // Update contact email_status
        if (send.contact_id) {
          await supabaseAdmin
            .from('contacts')
            .update({ email_status: 'unsubscribed' })
            .eq('id', send.contact_id)

          // Get contact email for suppression
          const { data: contact } = await supabaseAdmin
            .from('contacts')
            .select('email')
            .eq('id', send.contact_id)
            .single()

          // Insert unsubscribe event
          await supabaseAdmin.from('unsubscribe_events').insert({
            workspace_id: send.workspace_id,
            contact_id: send.contact_id,
            channel: 'email',
            reason: 'link_click',
            campaign_id: send.campaign_id,
          })

          // Log activity
          await supabaseAdmin.from('contact_activities').insert({
            workspace_id: send.workspace_id,
            contact_id: send.contact_id,
            activity_type: 'email_unsubscribed',
            metadata: { campaign_id: send.campaign_id },
          })

          // Increment campaign total_unsubscribed
          if (send.campaign_id) {
            const { data: campaign } = await supabaseAdmin
              .from('email_campaigns')
              .select('total_unsubscribed')
              .eq('id', send.campaign_id)
              .single()
            if (campaign) {
              await supabaseAdmin
                .from('email_campaigns')
                .update({ total_unsubscribed: (campaign.total_unsubscribed as number) + 1 })
                .eq('id', send.campaign_id)
            }
          }

          // Add to global suppression
          if (contact?.email) {
            try {
              await supabaseAdmin.from('global_suppression').upsert(
                { email: contact.email, reason: 'unsubscribe' },
                { onConflict: 'email' }
              )
            } catch {
              // suppression insert failed – non-critical
            }
          }
        }
      }
    } catch (err) {
      console.error('[UNSUBSCRIBE] Error:', err)
    }
  } else if (email) {
    await supabaseAdmin
      .from('contacts')
      .update({ email_status: 'unsubscribed' })
      .eq('email', email)
  }

  const displayName = workspaceName || 'this sender'

  return new NextResponse(
    `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Unsubscribed</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; text-align: center; padding: 80px 20px; background: #f9fafb; color: #111827; }
    .container { max-width: 480px; margin: 0 auto; background: white; border-radius: 12px; padding: 48px 32px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    h1 { font-size: 24px; margin-bottom: 12px; }
    p { color: #6b7280; font-size: 16px; line-height: 1.5; }
  </style>
</head>
<body>
  <div class="container">
    <h1>You've been unsubscribed</h1>
    <p>You will no longer receive emails from ${displayName}.</p>
    <p style="margin-top:24px;font-size:14px;color:#9ca3af;">If this was a mistake, contact the sender to re-subscribe.</p>
  </div>
</body>
</html>`,
    { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
  )
}
