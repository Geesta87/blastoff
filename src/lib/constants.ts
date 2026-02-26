export const APP_NAME = 'Blastoff'

// CSV Import
export const MAX_CSV_ROWS = 50_000

// Campaign batching
export const MAX_CAMPAIGN_BATCH_SIZE = 500

// SMS segment sizes
export const SMS_SEGMENT_SIZE = 160
export const SMS_UNICODE_SEGMENT_SIZE = 70

// Defaults
export const DEFAULT_FROM_NAME = 'Blastoff'
export const DEFAULT_REPLY_TO = ''

// Job queue
export const JOB_PRIORITIES = {
  urgent: 1,
  high: 3,
  normal: 5,
  low: 7,
} as const

export const MAX_JOB_RETRIES = 3
export const BACKOFF_MULTIPLIER = 5

// Trigger types
export const TRIGGER_TYPES = [
  'tag_added', 'tag_removed', 'contact_created', 'form_submitted',
  'webhook', 'date_field', 'email_opened', 'email_clicked',
  'sms_replied', 'manual', 'schedule',
] as const

// Automation step types
export const STEP_TYPES = [
  'send_email', 'send_sms', 'add_tag', 'remove_tag', 'wait',
  'update_field', 'webhook', 'if_else', 'go_to',
] as const

// Statuses
export const CONTACT_STATUSES = ['active', 'unsubscribed', 'bounced', 'complained', 'inactive'] as const
export const CAMPAIGN_STATUSES = ['draft', 'scheduled', 'sending', 'sent', 'paused', 'cancelled', 'failed'] as const
export const AUTOMATION_STATUSES = ['active', 'inactive', 'archived'] as const
export const SOCIAL_PLATFORMS = ['facebook', 'instagram', 'google_business'] as const

// Pagination
export const DEFAULT_PAGE_SIZE = 50
export const MAX_PAGE_SIZE = 200

// Tag colors
export const TAG_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#ef4444',
  '#f97316', '#eab308', '#22c55e', '#14b8a6', '#06b6d4',
  '#3b82f6', '#64748b',
] as const
