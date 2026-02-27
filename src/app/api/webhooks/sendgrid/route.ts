import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  try {
    const events = await request.json()

    if (!Array.isArray(events)) {
      return NextResponse.json({ error: 'Expected array' }, { status: 400 })
    }

    for (const event of events) {
      try {
        // Try to match by send_id in custom_args first, then by sg_message_id
        const sendId = event.send_id || event.custom_args?.send_id
        const sgMessageId = event.sg_message_id?.split('.')[0]

        if (!sendId && !sgMessageId) continue

        // Find the email_send record
        let send: Record<string, unknown> | null = null

        if (sendId) {
          const { data } = await supabaseAdmin
            .from('email_sends')
            .select('id, campaign_id, contact_id, workspace_id, opened_at, clicked_at')
            .eq('id', sendId)
            .single()
          send = data
        }

        if (!send && sgMessageId) {
          const { data } = await supabaseAdmin
            .from('email_sends')
            .select('id, campaign_id, contact_id, workspace_id, opened_at, clicked_at')
            .eq('sendgrid_message_id', sgMessageId)
            .single()
          send = data
        }

        if (!send) continue

        const now = new Date().toISOString()

        switch (event.event) {
          case 'delivered': {
            await supabaseAdmin.from('email_sends').update({
              status: 'delivered',
            }).eq('id', send.id)

            if (send.campaign_id) {
              const { data: c } = await supabaseAdmin
                .from('email_campaigns')
                .select('total_delivered')
                .eq('id', send.campaign_id)
                .single()
              if (c) {
                await supabaseAdmin.from('email_campaigns').update({
                  total_delivered: (c.total_delivered as number) + 1,
                }).eq('id', send.campaign_id)
              }
            }
            break
          }

          case 'bounce': {
            const bounceType = event.type || 'unknown' // 'bounce' or 'blocked'
            await supabaseAdmin.from('email_sends').update({
              status: 'bounced',
              bounced_at: now,
              bounce_type: bounceType,
            }).eq('id', send.id)

            if (send.campaign_id) {
              const { data: c } = await supabaseAdmin
                .from('email_campaigns')
                .select('total_bounced')
                .eq('id', send.campaign_id)
                .single()
              if (c) {
                await supabaseAdmin.from('email_campaigns').update({
                  total_bounced: (c.total_bounced as number) + 1,
                }).eq('id', send.campaign_id)
              }
            }

            // Hard bounce: update contact and add to suppression
            if (bounceType === 'bounce' && send.contact_id) {
              await supabaseAdmin.from('contacts').update({
                email_status: 'bounced',
              }).eq('id', send.contact_id)

              const { data: contact } = await supabaseAdmin
                .from('contacts')
                .select('email')
                .eq('id', send.contact_id)
                .single()

              if (contact?.email) {
                try {
                  await supabaseAdmin.from('global_suppression').upsert(
                    { email: contact.email, reason: 'hard_bounce' },
                    { onConflict: 'email' }
                  )
                } catch {
                  // suppression insert failed – non-critical
                }
              }

              if (send.workspace_id) {
                await supabaseAdmin.from('contact_activities').insert({
                  workspace_id: send.workspace_id as string,
                  contact_id: send.contact_id as string,
                  activity_type: 'email_bounced',
                  metadata: { campaign_id: send.campaign_id, bounce_type: bounceType },
                })
              }
            }
            break
          }

          case 'spamreport': {
            await supabaseAdmin.from('email_sends').update({
              status: 'complained',
            }).eq('id', send.id)

            if (send.campaign_id) {
              const { data: c } = await supabaseAdmin
                .from('email_campaigns')
                .select('total_complained')
                .eq('id', send.campaign_id)
                .single()
              if (c) {
                await supabaseAdmin.from('email_campaigns').update({
                  total_complained: (c.total_complained as number) + 1,
                }).eq('id', send.campaign_id)
              }
            }

            if (send.contact_id) {
              await supabaseAdmin.from('contacts').update({
                email_status: 'complained',
              }).eq('id', send.contact_id)

              const { data: contact } = await supabaseAdmin
                .from('contacts')
                .select('email')
                .eq('id', send.contact_id)
                .single()

              if (contact?.email) {
                try {
                  await supabaseAdmin.from('global_suppression').upsert(
                    { email: contact.email, reason: 'spam_report' },
                    { onConflict: 'email' }
                  )
                } catch {
                  // suppression insert failed – non-critical
                }
              }

              if (send.workspace_id) {
                await supabaseAdmin.from('unsubscribe_events').insert({
                  workspace_id: send.workspace_id as string,
                  contact_id: send.contact_id as string,
                  channel: 'email',
                  reason: 'spam_report',
                  campaign_id: send.campaign_id as string | null,
                })

                await supabaseAdmin.from('contact_activities').insert({
                  workspace_id: send.workspace_id as string,
                  contact_id: send.contact_id as string,
                  activity_type: 'email_complained',
                  metadata: { campaign_id: send.campaign_id },
                })
              }
            }
            break
          }

          case 'open': {
            // Dedup with opened_at check (same as tracking pixel)
            if (!send.opened_at) {
              await supabaseAdmin.from('email_sends').update({
                status: 'opened',
                opened_at: now,
              }).eq('id', send.id)

              if (send.campaign_id) {
                const { data: c } = await supabaseAdmin
                  .from('email_campaigns')
                  .select('total_opened')
                  .eq('id', send.campaign_id)
                  .single()
                if (c) {
                  await supabaseAdmin.from('email_campaigns').update({
                    total_opened: (c.total_opened as number) + 1,
                  }).eq('id', send.campaign_id)
                }
              }

              if (send.contact_id) {
                await supabaseAdmin.from('contacts').update({
                  last_opened_at: now,
                }).eq('id', send.contact_id)
              }
            }
            break
          }

          case 'click': {
            // Dedup
            if (!send.clicked_at) {
              await supabaseAdmin.from('email_sends').update({
                status: 'clicked',
                clicked_at: now,
              }).eq('id', send.id)

              if (send.campaign_id) {
                const { data: c } = await supabaseAdmin
                  .from('email_campaigns')
                  .select('total_clicked')
                  .eq('id', send.campaign_id)
                  .single()
                if (c) {
                  await supabaseAdmin.from('email_campaigns').update({
                    total_clicked: (c.total_clicked as number) + 1,
                  }).eq('id', send.campaign_id)
                }
              }

              if (send.contact_id) {
                await supabaseAdmin.from('contacts').update({
                  last_clicked_at: now,
                }).eq('id', send.contact_id)
              }
            }
            break
          }
        }
      } catch (eventErr) {
        console.error('[WEBHOOK_SENDGRID] Error processing event:', eventErr)
        // Continue processing other events
      }
    }

    // Always return 200 to SendGrid
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[WEBHOOK_SENDGRID] Error:', err)
    // Still return 200 to prevent SendGrid from retrying
    return NextResponse.json({ success: true })
  }
}
