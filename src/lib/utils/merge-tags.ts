interface MergeContact {
  first_name?: string | null
  last_name?: string | null
  email?: string | null
  phone?: string | null
  full_name?: string | null
  company_name?: string | null
  custom_fields?: Record<string, unknown>
}

export function replaceMergeTags(template: string, contact: MergeContact, extra?: Record<string, string>): string {
  return template.replace(/\{\{(\w+(?:\.\w+)?)\}\}/g, (match, key: string) => {
    if (key.startsWith('custom.')) {
      const fieldName = key.slice(7)
      const value = contact.custom_fields?.[fieldName]
      return value != null ? String(value) : ''
    }

    // Check extra values (e.g., unsubscribe_url)
    if (extra && key in extra) {
      return extra[key]
    }

    switch (key) {
      case 'first_name': return contact.first_name || ''
      case 'last_name': return contact.last_name || ''
      case 'email': return contact.email || ''
      case 'phone': return contact.phone || ''
      case 'company_name': return contact.company_name || ''
      case 'full_name':
        return contact.full_name || [contact.first_name, contact.last_name].filter(Boolean).join(' ') || ''
      default: return ''
    }
  })
}

export function extractMergeTags(template: string): string[] {
  const matches = template.match(/\{\{(\w+(?:\.\w+)?)\}\}/g) || []
  return Array.from(new Set(matches.map(m => m.slice(2, -2))))
}

export function addTrackingPixel(html: string, sendId: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const pixelUrl = `${baseUrl}/api/track/open?id=${sendId}`
  const pixel = `<img src="${pixelUrl}" width="1" height="1" alt="" style="display:none" />`

  // Insert before </body> if present, otherwise append
  if (html.includes('</body>')) {
    return html.replace('</body>', `${pixel}</body>`)
  }
  return html + pixel
}

export function rewriteLinks(html: string, sendId: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

  return html.replace(/<a\s+([^>]*?)href=["']([^"']+)["']([^>]*?)>/gi, (fullMatch, before, href, after) => {
    // Skip mailto, tel, anchor links, unsubscribe links, and already-tracked links
    if (
      href.startsWith('mailto:') ||
      href.startsWith('tel:') ||
      href.startsWith('#') ||
      href.includes('/api/unsubscribe') ||
      href.includes('/api/track/')
    ) {
      return fullMatch
    }

    const trackUrl = `${baseUrl}/api/track/click?id=${sendId}&url=${encodeURIComponent(href)}`
    return `<a ${before}href="${trackUrl}"${after}>`
  })
}

export function personalizeContent(
  html: string,
  contact: MergeContact,
  sendId: string,
  unsubscribeUrl: string
): string {
  // 1. Replace merge tags
  let result = replaceMergeTags(html, contact, { unsubscribe_url: unsubscribeUrl })
  // 2. Rewrite links for click tracking
  result = rewriteLinks(result, sendId)
  // 3. Add tracking pixel
  result = addTrackingPixel(result, sendId)
  return result
}

export function htmlToPlainText(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/h[1-6]>/gi, '\n\n')
    .replace(/<li>/gi, '- ')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
