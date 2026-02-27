import { calculateSMSSegments } from '@/lib/utils/sms-segments'

interface SendSMSOptions {
  to: string
  body: string
  from?: string
  workspaceId: string
  statusCallbackUrl?: string
  sendId?: string
}

interface SMSResult {
  sid: string
  status: string
  numSegments: number
  price: string | null
  errorCode: string | null
  errorMessage: string | null
}

// Twilio error codes we handle specially
export const TWILIO_ERRORS = {
  INVALID_NUMBER: '21211',
  NOT_MOBILE: '21614',
  STOP_MESSAGE: '21610',     // Recipient sent STOP
  CARRIER_VIOLATION: '30007',
  UNREACHABLE: '30003',
  BLOCKED: '30004',
  UNKNOWN: '30005',
} as const

// Validate E.164 format
export function validateE164(phone: string): boolean {
  return /^\+[1-9]\d{6,14}$/.test(phone)
}

// Normalize phone to E.164 (basic US handling)
export function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.length === 10) return `+1${digits}`
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`
  if (phone.startsWith('+')) return phone
  return `+${digits}`
}

export async function sendSMS(options: SendSMSOptions): Promise<SMSResult> {
  const to = normalizePhone(options.to)

  if (!validateE164(to)) {
    return {
      sid: '',
      status: 'failed',
      numSegments: 0,
      price: null,
      errorCode: TWILIO_ERRORS.INVALID_NUMBER,
      errorMessage: `Invalid phone number: ${options.to}`,
    }
  }

  // Mock mode
  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
    const segments = calculateSMSSegments(options.body)
    const mockSid = `MOCK_SM${Date.now()}${Math.random().toString(36).substring(2, 8)}`
    console.log(
      `[MOCK] SMS → ${to} | ${segments.segmentCount} seg | Body: ${options.body.substring(0, 60)}...`
    )
    return {
      sid: mockSid,
      status: 'sent',
      numSegments: segments.segmentCount,
      price: `-${(segments.segmentCount * 0.0079).toFixed(4)}`,
      errorCode: null,
      errorMessage: null,
    }
  }

  // Real Twilio
  const twilio = (await import('twilio')).default
  const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const statusCallback = options.statusCallbackUrl ||
    (options.sendId ? `${baseUrl}/api/webhooks/twilio?send_id=${options.sendId}` : undefined)

  try {
    const createParams: Record<string, unknown> = {
      to,
      from: options.from || process.env.TWILIO_PHONE_NUMBER || '',
      body: options.body,
    }
    if (statusCallback) {
      createParams.statusCallback = statusCallback
    }

    const message = await client.messages.create(
      createParams as unknown as Parameters<typeof client.messages.create>[0]
    )

    return {
      sid: message.sid,
      status: message.status,
      numSegments: parseInt(message.numSegments || '1', 10),
      price: message.price,
      errorCode: message.errorCode ? String(message.errorCode) : null,
      errorMessage: message.errorMessage,
    }
  } catch (err: unknown) {
    const twilioErr = err as { code?: number; message?: string }
    return {
      sid: '',
      status: 'failed',
      numSegments: 0,
      price: null,
      errorCode: twilioErr.code ? String(twilioErr.code) : null,
      errorMessage: twilioErr.message || 'Unknown Twilio error',
    }
  }
}

export async function getMessageStatus(sid: string): Promise<{ status: string; price: string | null }> {
  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
    return { status: 'delivered', price: '-0.0079' }
  }
  const twilio = (await import('twilio')).default
  const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
  const message = await client.messages(sid).fetch()
  return { status: message.status, price: message.price }
}
