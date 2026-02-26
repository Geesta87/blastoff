import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  const formData = await request.formData()
  const sid = formData.get('MessageSid') as string
  const status = formData.get('MessageStatus') as string
  const errorCode = formData.get('ErrorCode') as string | null

  if (!sid || !status) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const updateData: Record<string, unknown> = { status }
  if (status === 'delivered') updateData.delivered_at = new Date().toISOString()
  if (errorCode) updateData.error_code = errorCode

  await supabaseAdmin
    .from('sms_sends')
    .update(updateData)
    .eq('sid', sid)

  return NextResponse.json({ success: true })
}
