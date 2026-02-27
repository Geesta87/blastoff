/**
 * Utility functions for formatting display values.
 */

/**
 * Format a phone number to (XXX) XXX-XXXX for US numbers.
 * Returns international numbers as-is.
 */
export function formatPhone(phone: string): string {
  if (!phone) return ''

  // Strip all non-digit characters except leading +
  const cleaned = phone.replace(/[^\d+]/g, '')

  // Handle US numbers: +1XXXXXXXXXX or 1XXXXXXXXXX or XXXXXXXXXX
  let digits = cleaned.replace(/^\+/, '')

  if (digits.startsWith('1') && digits.length === 11) {
    digits = digits.slice(1)
  }

  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
  }

  // International or unrecognized format — return as-is
  return phone
}

/**
 * Convert an ISO date string to a relative time string.
 * Examples: "just now", "5m ago", "2h ago", "3d ago", "2w ago", "3mo ago", "1y ago"
 */
export function formatRelativeTime(date: string): string {
  if (!date) return ''

  const now = Date.now()
  const then = new Date(date).getTime()
  const diffMs = now - then

  if (diffMs < 0) return 'just now'

  const seconds = Math.floor(diffMs / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)
  const weeks = Math.floor(days / 7)
  const months = Math.floor(days / 30)
  const years = Math.floor(days / 365)

  if (seconds < 60) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days < 7) return `${days}d ago`
  if (weeks < 5) return `${weeks}w ago`
  if (months < 12) return `${months}mo ago`
  return `${years}y ago`
}

/**
 * Map a contact status to a Badge variant.
 */
export function statusVariant(
  status: string
): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'active':
      return 'default'
    case 'inactive':
      return 'secondary'
    case 'bounced':
    case 'complained':
      return 'destructive'
    case 'unsubscribed':
      return 'outline'
    default:
      return 'secondary'
  }
}

/**
 * Truncate a string to a given length, appending an ellipsis if needed.
 */
export function truncate(str: string, len: number): string {
  if (!str) return ''
  if (str.length <= len) return str
  return str.slice(0, len) + '...'
}
