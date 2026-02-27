import { NextRequest, NextResponse } from 'next/server'
import { getWorkspaceId } from '@/lib/utils/workspace'
import { sendEmail } from '@/lib/services/sendgrid'
import { replaceMergeTags } from '@/lib/utils/merge-tags'

export async function POST(request: NextRequest) {
  try {
    const workspaceId = await getWorkspaceId()
    if (!workspaceId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { to_email, subject, html_body, from_email, from_name } = await request.json()
    if (!to_email) return NextResponse.json({ error: 'to_email required' }, { status: 400 })

    // Use sample merge tag data
    const sampleContact = {
      first_name: 'Jane',
      last_name: 'Doe',
      email: to_email,
      full_name: 'Jane Doe',
      company_name: 'Acme Inc',
    }

    const personalizedSubject = replaceMergeTags(subject || '', sampleContact)
    const personalizedHtml = replaceMergeTags(html_body || '', sampleContact, {
      unsubscribe_url: '#',
    })

    const result = await sendEmail({
      to: to_email,
      from: from_email || 'noreply@app.blastoff.io',
      fromName: from_name || 'Blastoff',
      subject: `[TEST] ${personalizedSubject}`,
      html: personalizedHtml,
    })

    return NextResponse.json({ success: true, messageId: result.messageId })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to send test email' },
      { status: 500 }
    )
  }
}
