import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/utils/workspace'
import { enqueueJob } from '@/lib/services/job-queue'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const workspaceId = await getWorkspaceId()
    if (!workspaceId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const supabase = await createServerClient()

    const { data: campaign, error } = await supabase
      .from('sms_campaigns')
      .select('*')
      .eq('id', id)
      .eq('workspace_id', workspaceId)
      .single()

    if (error || !campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    if (campaign.status !== 'draft' && campaign.status !== 'scheduled') {
      return NextResponse.json(
        { error: 'Campaign can only be sent from draft or scheduled status' },
        { status: 400 }
      )
    }

    // Check workspace has a from number configured
    const { data: workspace } = await supabase
      .from('workspaces')
      .select('twilio_phone_number, settings')
      .eq('id', workspaceId)
      .single()

    const fromNumber = campaign.from_number || workspace?.twilio_phone_number
    if (!fromNumber && !process.env.TWILIO_PHONE_NUMBER) {
      return NextResponse.json(
        { error: 'No phone number configured. Set a from number on the campaign or workspace.' },
        { status: 400 }
      )
    }

    // Set status to sending immediately
    await supabase
      .from('sms_campaigns')
      .update({ status: 'sending', started_at: new Date().toISOString() })
      .eq('id', id)
      .eq('workspace_id', workspaceId)

    // Enqueue job
    await enqueueJob({
      workspaceId: campaign.workspace_id,
      type: 'sms_campaign_send',
      payload: {
        campaign_id: id,
        workspace_id: campaign.workspace_id,
        batch_offset: 0,
      },
      priority: 1,
      idempotencyKey: `sms_send_${id}`,
    })

    return NextResponse.json({ success: true, status: 'sending' })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
