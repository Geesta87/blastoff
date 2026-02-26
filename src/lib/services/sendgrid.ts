interface SendEmailOptions {
  to: string
  from: string
  fromName?: string
  subject: string
  html: string
  text?: string
  replyTo?: string
  headers?: Record<string, string>
}

interface EmailResult {
  messageId: string
  status: string
}

interface BatchEmailResult {
  sent: number
  failed: number
  results: { to: string; messageId: string | null; error: string | null }[]
}

export async function sendEmail(options: SendEmailOptions): Promise<EmailResult> {
  if (!process.env.SENDGRID_API_KEY) {
    const mockId = `mock_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`
    console.log('[MOCK] Email would send to:', options.to, 'Subject:', options.subject)
    return { messageId: mockId, status: 'sent' }
  }

  const sgMail = (await import('@sendgrid/mail')).default
  sgMail.setApiKey(process.env.SENDGRID_API_KEY)

  const [response] = await sgMail.send({
    to: options.to,
    from: { email: options.from, name: options.fromName || undefined },
    subject: options.subject,
    html: options.html,
    text: options.text || undefined,
    replyTo: options.replyTo || undefined,
    headers: options.headers || undefined,
  })

  const messageId = response.headers?.['x-message-id'] || `sg_${Date.now()}`
  return { messageId, status: response.statusCode === 202 ? 'accepted' : 'sent' }
}

export async function sendBatchEmails(emails: SendEmailOptions[]): Promise<BatchEmailResult> {
  if (!process.env.SENDGRID_API_KEY) {
    const results = emails.map((email) => ({
      to: email.to,
      messageId: `mock_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`,
      error: null,
    }))
    console.log(`[MOCK] Batch email would send ${emails.length} emails`)
    return { sent: emails.length, failed: 0, results }
  }

  let sent = 0
  let failed = 0
  const results: BatchEmailResult['results'] = []

  for (const email of emails) {
    try {
      const result = await sendEmail(email)
      sent++
      results.push({ to: email.to, messageId: result.messageId, error: null })
    } catch (err: unknown) {
      failed++
      const message = err instanceof Error ? err.message : 'Unknown error'
      results.push({ to: email.to, messageId: null, error: message })
    }
  }

  return { sent, failed, results }
}
