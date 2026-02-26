interface SendSMSOptions {
  to: string
  body: string
  from?: string
  workspaceId: string
}

interface SMSResult {
  sid: string
  status: string
  numSegments: number
  price: string | null
  errorCode: string | null
  errorMessage: string | null
}

export async function sendSMS(options: SendSMSOptions): Promise<SMSResult> {
  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
    console.log('[MOCK] SMS would send to:', options.to, 'Body:', options.body.substring(0, 50))
    return {
      sid: `MOCK_SM${Date.now()}${Math.random().toString(36).substring(2, 8)}`,
      status: 'sent',
      numSegments: Math.ceil(options.body.length / 160),
      price: '-0.0075',
      errorCode: null,
      errorMessage: null,
    }
  }

  const twilio = (await import('twilio')).default
  const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
  const message = await client.messages.create({
    to: options.to,
    from: options.from || process.env.TWILIO_PHONE_NUMBER || '',
    body: options.body,
  })

  return {
    sid: message.sid,
    status: message.status,
    numSegments: parseInt(message.numSegments || '1', 10),
    price: message.price,
    errorCode: message.errorCode ? String(message.errorCode) : null,
    errorMessage: message.errorMessage,
  }
}

export async function getMessageStatus(sid: string): Promise<{ status: string; price: string | null }> {
  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
    return { status: 'delivered', price: '-0.0075' }
  }
  const twilio = (await import('twilio')).default
  const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
  const message = await client.messages(sid).fetch()
  return { status: message.status, price: message.price }
}
