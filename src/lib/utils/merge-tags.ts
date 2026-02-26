interface MergeContact {
  first_name?: string | null
  last_name?: string | null
  email?: string | null
  phone?: string | null
  full_name?: string | null
  custom_fields?: Record<string, unknown>
}

export function replaceMergeTags(template: string, contact: MergeContact): string {
  return template.replace(/\{\{(\w+(?:\.\w+)?)\}\}/g, (match, key: string) => {
    if (key.startsWith('custom.')) {
      const fieldName = key.slice(7)
      const value = contact.custom_fields?.[fieldName]
      return value != null ? String(value) : ''
    }

    switch (key) {
      case 'first_name': return contact.first_name || ''
      case 'last_name': return contact.last_name || ''
      case 'email': return contact.email || ''
      case 'phone': return contact.phone || ''
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
