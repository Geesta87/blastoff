import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ webhookId: string }> }
) {
  try {
    const { webhookId } = await params

    // Look up the automation webhook
    const { data: webhook } = await supabaseAdmin
      .from('automation_webhooks')
      .select('*, automation:automations(id, workspace_id, status)')
      .eq('id', webhookId)
      .single()

    if (!webhook || !webhook.automation) {
      return NextResponse.json({ error: 'Webhook not found' }, { status: 404 })
    }

    const automation = webhook.automation as Record<string, unknown>

    // Validate secret if configured
    if (webhook.secret) {
      const authHeader = request.headers.get('authorization')
      const providedSecret = authHeader?.replace('Bearer ', '')
      if (providedSecret !== webhook.secret) {
        return NextResponse.json({ error: 'Invalid secret' }, { status: 401 })
      }
    }

    if (automation.status !== 'active') {
      return NextResponse.json({ error: 'Automation is not active' }, { status: 400 })
    }

    // Parse request body
    let body: Record<string, unknown> = {}
    try {
      body = await request.json()
    } catch {
      // Body may be empty or not JSON
    }

    const workspaceId = automation.workspace_id as string

    // Find or create contact from webhook data
    let contactId: string | null = null
    const email = body.email as string | undefined
    const phone = body.phone as string | undefined

    if (email || phone) {
      // Try to find existing contact
      let contactQuery = supabaseAdmin
        .from('contacts')
        .select('id')
        .eq('workspace_id', workspaceId)

      if (email) {
        contactQuery = contactQuery.eq('email', email.toLowerCase())
      } else if (phone) {
        contactQuery = contactQuery.eq('phone', phone)
      }

      const { data: existingContact } = await contactQuery.maybeSingle()

      if (existingContact) {
        contactId = existingContact.id
      } else {
        // Create new contact
        const { data: newContact } = await supabaseAdmin
          .from('contacts')
          .insert({
            workspace_id: workspaceId,
            email: email?.toLowerCase() || null,
            phone: phone || null,
            first_name: (body.first_name as string) || null,
            last_name: (body.last_name as string) || null,
            source: 'webhook',
          })
          .select('id')
          .single()

        if (newContact) {
          contactId = newContact.id

          // Emit contact_created event
          await supabaseAdmin.from('event_log').insert({
            workspace_id: workspaceId,
            event_type: 'contact_created',
            contact_id: contactId,
            payload: { contact_id: contactId, source: 'webhook', webhook_id: webhookId },
            processed: false,
          })
        }
      }
    }

    // Emit webhook_received event (picked up by event router)
    await supabaseAdmin.from('event_log').insert({
      workspace_id: workspaceId,
      event_type: 'webhook_received',
      contact_id: contactId,
      payload: {
        webhook_id: webhookId,
        automation_id: automation.id,
        contact_id: contactId,
        data: body,
      },
      processed: false,
    })

    return NextResponse.json({ success: true, contact_id: contactId })
  } catch (err) {
    console.error('[WEBHOOK_AUTOMATION] Error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
