import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { enqueueJob } from '@/lib/services/job-queue'

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createServerClient()

  const { data: campaign, error } = await supabase
    .from('email_campaigns')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !campaign) {
    return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
  }

  if (campaign.status !== 'draft') {
    return NextResponse.json({ error: 'Campaign already sent or sending' }, { status: 400 })
  }

  await supabase
    .from('email_campaigns')
    .update({ status: 'queued' })
    .eq('id', id)

  await enqueueJob({
    workspaceId: campaign.workspace_id,
    type: 'email_campaign_send',
    payload: { campaignId: id, workspaceId: campaign.workspace_id },
    priority: 1,
    idempotencyKey: `email_send_${id}`,
  })

  return NextResponse.json({ success: true, status: 'queued' })
}
