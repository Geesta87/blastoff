import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

// 1x1 transparent GIF
const PIXEL = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64'
)

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const sendId = searchParams.get('id')

  if (sendId) {
    try {
      // Only update if not already opened (dedup)
      const { data: send } = await supabaseAdmin
        .from('email_sends')
        .select('id, campaign_id, contact_id, workspace_id, opened_at')
        .eq('id', sendId)
        .single()

      if (send && !send.opened_at) {
        const now = new Date().toISOString()

        // Update email_sends
        await supabaseAdmin
          .from('email_sends')
          .update({ status: 'opened', opened_at: now })
          .eq('id', sendId)

        // Increment campaign total_opened
        if (send.campaign_id) {
          const { data: campaign } = await supabaseAdmin
            .from('email_campaigns')
            .select('total_opened')
            .eq('id', send.campaign_id)
            .single()
          if (campaign) {
            await supabaseAdmin
              .from('email_campaigns')
              .update({ total_opened: (campaign.total_opened as number) + 1 })
              .eq('id', send.campaign_id)
          }
        }

        // Update contact last_opened_at
        if (send.contact_id) {
          await supabaseAdmin
            .from('contacts')
            .update({ last_opened_at: now })
            .eq('id', send.contact_id)
        }

        // Log activity
        if (send.contact_id && send.workspace_id) {
          await supabaseAdmin.from('contact_activities').insert({
            workspace_id: send.workspace_id,
            contact_id: send.contact_id,
            activity_type: 'email_opened',
            metadata: { campaign_id: send.campaign_id, send_id: sendId },
          })
        }

        // Log event
        if (send.workspace_id) {
          await supabaseAdmin.from('event_log').insert({
            workspace_id: send.workspace_id,
            event_type: 'email_opened',
            payload: { send_id: sendId, campaign_id: send.campaign_id, contact_id: send.contact_id },
          })
        }
      }
    } catch (err) {
      console.error('[TRACK_OPEN] Error:', err)
    }
  }

  return new NextResponse(PIXEL, {
    headers: {
      'Content-Type': 'image/gif',
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
    },
  })
}
