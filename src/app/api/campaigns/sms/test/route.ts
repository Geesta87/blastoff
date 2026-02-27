import { NextRequest, NextResponse } from 'next/server'
import { getWorkspaceId } from '@/lib/utils/workspace'
import { sendSMS } from '@/lib/services/twilio'

export async function POST(request: NextRequest) {
  try {
    const workspaceId = await getWorkspaceId()
    if (!workspaceId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const { to_phone, body: smsBody, from_number } = body

    if (!to_phone) {
      return NextResponse.json({ error: 'Phone number is required' }, { status: 400 })
    }
    if (!smsBody) {
      return NextResponse.json({ error: 'Message body is required' }, { status: 400 })
    }

    const result = await sendSMS({
      to: to_phone,
      body: `[TEST] ${smsBody}`,
      from: from_number || undefined,
      workspaceId,
    })

    if (result.errorCode) {
      return NextResponse.json(
        { error: result.errorMessage || 'Failed to send test SMS', errorCode: result.errorCode },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      sid: result.sid,
      segments: result.numSegments,
    })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
