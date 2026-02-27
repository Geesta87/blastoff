import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { TWILIO_ERRORS } from '@/lib/services/twilio'

export async function POST(request: NextRequest) {
  try {
    // Twilio sends form-encoded data
    const formData = await request.formData()
    const messageSid = formData.get('MessageSid') as string | null
    const messageStatus = formData.get('MessageStatus') as string | null
    const errorCode = formData.get('ErrorCode') as string | null

    // Also check query params for send_id
    const { searchParams } = new URL(request.url)
    const sendId = searchParams.get('send_id')

    if (!messageSid && !sendId) {
      return NextResponse.json({ success: true })
    }

    // Find the sms_send record
    let send: Record<string, unknown> | null = null

    if (sendId) {
      const { data } = await supabaseAdmin
        .from('sms_sends')
        .select('id, campaign_id, contact_id, workspace_id, to_number')
        .eq('id', sendId)
        .single()
      send = data
    }

    if (!send && messageSid) {
      const { data } = await supabaseAdmin
        .from('sms_sends')
        .select('id, campaign_id, contact_id, workspace_id, to_number')
        .eq('twilio_sid', messageSid)
        .single()
      send = data
    }

    if (!send) {
      return NextResponse.json({ success: true })
    }

    const now = new Date().toISOString()

    switch (messageStatus) {
      case 'sent': {
        await supabaseAdmin.from('sms_sends').update({
          status: 'sent',
          sent_at: now,
        }).eq('id', send.id)
        break
      }

      case 'delivered': {
        await supabaseAdmin.from('sms_sends').update({
          status: 'delivered',
          delivered_at: now,
        }).eq('id', send.id)

        // Increment campaign total_delivered
        if (send.campaign_id) {
          const { data: c } = await supabaseAdmin
            .from('sms_campaigns')
            .select('total_delivered')
            .eq('id', send.campaign_id)
            .single()
          if (c) {
            await supabaseAdmin.from('sms_campaigns').update({
              total_delivered: (c.total_delivered as number) + 1,
            }).eq('id', send.campaign_id)
          }
        }

        // Log activity
        if (send.workspace_id && send.contact_id) {
          await supabaseAdmin.from('contact_activities').insert({
            workspace_id: send.workspace_id as string,
            contact_id: send.contact_id as string,
            activity_type: 'sms_delivered',
            metadata: { campaign_id: send.campaign_id, twilio_sid: messageSid },
          })
        }

        // Emit event for automation engine
        if (send.workspace_id) {
          await supabaseAdmin.from('event_log').insert({
            workspace_id: send.workspace_id as string,
            event_type: 'sms_delivered',
            contact_id: send.contact_id as string || null,
            payload: { send_id: send.id, campaign_id: send.campaign_id, contact_id: send.contact_id },
            processed: false,
          })
        }
        break
      }

      case 'undelivered': {
        await supabaseAdmin.from('sms_sends').update({
          status: 'undelivered',
          error_code: errorCode,
          error_message: getErrorMessage(errorCode),
        }).eq('id', send.id)

        // Increment campaign total_failed
        if (send.campaign_id) {
          const { data: c } = await supabaseAdmin
            .from('sms_campaigns')
            .select('total_failed')
            .eq('id', send.campaign_id)
            .single()
          if (c) {
            await supabaseAdmin.from('sms_campaigns').update({
              total_failed: (c.total_failed as number) + 1,
            }).eq('id', send.campaign_id)
          }
        }

        // Handle STOP message (21610) - recipient opted out
        if (errorCode === TWILIO_ERRORS.STOP_MESSAGE && send.contact_id) {
          await supabaseAdmin.from('contacts').update({
            sms_status: 'stopped',
          }).eq('id', send.contact_id)

          // Add to suppression list
          if (send.to_number) {
            try {
              await supabaseAdmin.from('global_suppression').upsert(
                { phone: send.to_number as string, reason: 'sms_stop' },
                { onConflict: 'phone' }
              )
            } catch {
              // suppression insert failed – non-critical
            }
          }

          // Log unsubscribe event
          if (send.workspace_id) {
            await supabaseAdmin.from('unsubscribe_events').insert({
              workspace_id: send.workspace_id as string,
              contact_id: send.contact_id as string,
              channel: 'sms',
              reason: 'stop_reply',
              campaign_id: send.campaign_id as string | null,
            })

            await supabaseAdmin.from('contact_activities').insert({
              workspace_id: send.workspace_id as string,
              contact_id: send.contact_id as string,
              activity_type: 'sms_stopped',
              metadata: { campaign_id: send.campaign_id },
            })
          }
        }
        break
      }

      case 'failed': {
        await supabaseAdmin.from('sms_sends').update({
          status: 'failed',
          error_code: errorCode,
          error_message: getErrorMessage(errorCode),
        }).eq('id', send.id)

        // Increment campaign total_failed
        if (send.campaign_id) {
          const { data: c } = await supabaseAdmin
            .from('sms_campaigns')
            .select('total_failed, status')
            .eq('id', send.campaign_id)
            .single()
          if (c) {
            await supabaseAdmin.from('sms_campaigns').update({
              total_failed: (c.total_failed as number) + 1,
            }).eq('id', send.campaign_id)

            // Carrier violation (30007) - pause the campaign
            if (errorCode === TWILIO_ERRORS.CARRIER_VIOLATION && c.status === 'sending') {
              await supabaseAdmin.from('sms_campaigns').update({
                status: 'paused',
              }).eq('id', send.campaign_id)

              // Log event
              try {
                await supabaseAdmin.from('event_log').insert({
                  workspace_id: send.workspace_id as string,
                  event_type: 'sms_campaign_paused',
                  metadata: {
                    campaign_id: send.campaign_id,
                    reason: 'carrier_violation',
                    error_code: errorCode,
                  },
                })
              } catch {
                // event log insert failed – non-critical
              }
            }
          }
        }
        break
      }
    }

    // Always return 200 to Twilio
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[WEBHOOK_TWILIO] Error:', err)
    // Still return 200 to prevent Twilio from retrying
    return NextResponse.json({ success: true })
  }
}

function getErrorMessage(errorCode: string | null): string {
  if (!errorCode) return 'Unknown error'
  switch (errorCode) {
    case TWILIO_ERRORS.INVALID_NUMBER: return 'Invalid phone number'
    case TWILIO_ERRORS.NOT_MOBILE: return 'Not a mobile number'
    case TWILIO_ERRORS.STOP_MESSAGE: return 'Recipient sent STOP'
    case TWILIO_ERRORS.CARRIER_VIOLATION: return 'Carrier violation'
    case TWILIO_ERRORS.UNREACHABLE: return 'Unreachable'
    case TWILIO_ERRORS.BLOCKED: return 'Blocked'
    case TWILIO_ERRORS.UNKNOWN: return 'Unknown delivery error'
    default: return `Error code: ${errorCode}`
  }
}
