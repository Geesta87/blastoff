import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const sendId = searchParams.get('id')
  const url = searchParams.get('url')

  if (!url || !url.startsWith('http')) {
    return NextResponse.json({ error: 'Missing or invalid url parameter' }, { status: 400 })
  }

  if (sendId) {
    try {
      const { data: send } = await supabaseAdmin
        .from('email_sends')
        .select('id, campaign_id, contact_id, workspace_id, clicked_at')
        .eq('id', sendId)
        .single()

      if (send && !send.clicked_at) {
        const now = new Date().toISOString()

        // Update email_sends (first click only)
        await supabaseAdmin
          .from('email_sends')
          .update({ status: 'clicked', clicked_at: now })
          .eq('id', sendId)

        // Increment campaign total_clicked
        if (send.campaign_id) {
          const { data: campaign } = await supabaseAdmin
            .from('email_campaigns')
            .select('total_clicked')
            .eq('id', send.campaign_id)
            .single()
          if (campaign) {
            await supabaseAdmin
              .from('email_campaigns')
              .update({ total_clicked: (campaign.total_clicked as number) + 1 })
              .eq('id', send.campaign_id)
          }
        }

        // Update contact
        if (send.contact_id) {
          await supabaseAdmin
            .from('contacts')
            .update({ last_clicked_at: now })
            .eq('id', send.contact_id)
        }

        // Log activity
        if (send.contact_id && send.workspace_id) {
          await supabaseAdmin.from('contact_activities').insert({
            workspace_id: send.workspace_id,
            contact_id: send.contact_id,
            activity_type: 'email_clicked',
            metadata: { campaign_id: send.campaign_id, send_id: sendId, url },
          })
        }

        // Log event
        if (send.workspace_id) {
          await supabaseAdmin.from('event_log').insert({
            workspace_id: send.workspace_id,
            event_type: 'email_clicked',
            payload: { send_id: sendId, campaign_id: send.campaign_id, contact_id: send.contact_id, url },
          })
        }
      }
    } catch (err) {
      console.error('[TRACK_CLICK] Error:', err)
    }
  }

  return NextResponse.redirect(url)
}
