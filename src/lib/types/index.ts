// ============================================================
// Status union types
// ============================================================
export type ContactStatus = 'active' | 'unsubscribed' | 'bounced' | 'complained' | 'inactive'
export type EmailContactStatus = 'active' | 'unsubscribed' | 'bounced' | 'complained'
export type SmsContactStatus = 'active' | 'unsubscribed' | 'stopped'
export type CampaignStatus = 'draft' | 'scheduled' | 'sending' | 'sent' | 'paused' | 'cancelled' | 'failed'
export type EmailSendStatus = 'queued' | 'sent' | 'delivered' | 'opened' | 'clicked' | 'bounced' | 'complained' | 'failed'
export type SmsSendStatus = 'queued' | 'sent' | 'delivered' | 'undelivered' | 'failed'
export type AutomationStatus = 'active' | 'inactive' | 'archived'
export type AutomationRunStatus = 'active' | 'completed' | 'failed' | 'cancelled' | 'waiting'
export type SocialPlatform = 'facebook' | 'instagram' | 'google_business'
export type SocialPostStatus = 'draft' | 'scheduled' | 'publishing' | 'published' | 'failed' | 'partially_failed'
export type SocialPostResultStatus = 'pending' | 'published' | 'failed'
export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled'
export type WorkspaceMemberRole = 'owner' | 'admin' | 'member' | 'viewer'
export type UnsubscribeChannel = 'email' | 'sms'

export type TriggerType =
  | 'tag_added' | 'tag_removed' | 'contact_created' | 'form_submitted'
  | 'webhook' | 'date_field' | 'email_opened' | 'email_clicked'
  | 'sms_replied' | 'manual' | 'schedule'

export type JobType =
  | 'email_campaign_send' | 'sms_campaign_send' | 'automation_step'
  | 'social_post_publish' | 'token_refresh' | 'segment_recount'
  | 'engagement_fetch'

// ============================================================
// Filter / Segment types
// ============================================================
export interface FilterCondition {
  field: string
  operator: 'equals' | 'not_equals' | 'contains' | 'not_contains' | 'starts_with'
    | 'greater_than' | 'less_than' | 'is_empty' | 'is_not_empty' | 'in_list'
  value: string | number | boolean | string[] | null
}

export interface FilterRules {
  operator: 'AND' | 'OR'
  conditions: FilterCondition[]
}

// ============================================================
// Automation step
// ============================================================
export interface AutomationStep {
  id: string
  type: 'send_email' | 'send_sms' | 'add_tag' | 'remove_tag' | 'wait'
    | 'update_field' | 'webhook' | 'if_else' | 'go_to'
  config: Record<string, unknown>
  delay_minutes?: number
}

// ============================================================
// Database row types
// ============================================================
export interface Workspace {
  id: string
  name: string
  slug: string
  owner_id: string
  settings: Record<string, unknown>
  twilio_phone_number: string | null
  sendgrid_from_email: string | null
  sendgrid_from_name: string | null
  meta_access_token: string | null
  meta_token_expires_at: string | null
  meta_pages: unknown[]
  google_refresh_token: string | null
  google_locations: unknown[]
  monthly_sms_limit: number
  monthly_email_limit: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface WorkspaceMember {
  id: string
  workspace_id: string
  user_id: string
  role: WorkspaceMemberRole
  created_at: string
}

export interface Contact {
  id: string
  workspace_id: string
  email: string | null
  phone: string | null
  first_name: string | null
  last_name: string | null
  full_name: string | null
  source: string
  status: ContactStatus
  email_status: EmailContactStatus
  sms_status: SmsContactStatus
  custom_fields: Record<string, unknown>
  last_contacted_at: string | null
  last_opened_at: string | null
  last_clicked_at: string | null
  lead_score: number
  created_at: string
  updated_at: string
  tags?: Tag[]
}

export interface Tag {
  id: string
  workspace_id: string
  name: string
  color: string
  created_at: string
  contact_count?: number
}

export interface ContactTag {
  contact_id: string
  tag_id: string
  created_at: string
}

export interface Segment {
  id: string
  workspace_id: string
  name: string
  description: string | null
  filter_rules: FilterRules
  contact_count: number
  is_dynamic: boolean
  created_at: string
  updated_at: string
}

export interface SegmentMember {
  segment_id: string
  contact_id: string
}

export interface ContactActivity {
  id: string
  workspace_id: string
  contact_id: string
  activity_type: string
  metadata: Record<string, unknown>
  created_at: string
}

export interface EmailTemplate {
  id: string
  workspace_id: string
  name: string
  subject: string
  html_body: string
  text_body: string | null
  preview_text: string | null
  variables: string[]
  thumbnail_url: string | null
  is_archived: boolean
  created_at: string
  updated_at: string
}

export interface EmailCampaign {
  id: string
  workspace_id: string
  name: string
  subject: string
  from_name: string
  from_email: string
  reply_to: string | null
  html_body: string
  text_body: string | null
  preview_text: string | null
  template_id: string | null
  segment_id: string | null
  tag_ids: string[]
  exclude_tag_ids: string[]
  status: CampaignStatus
  scheduled_at: string | null
  started_at: string | null
  completed_at: string | null
  total_recipients: number
  total_sent: number
  total_delivered: number
  total_opened: number
  total_clicked: number
  total_bounced: number
  total_complained: number
  total_unsubscribed: number
  created_at: string
  updated_at: string
}

export interface EmailSend {
  id: string
  campaign_id: string | null
  contact_id: string
  workspace_id: string
  sendgrid_message_id: string | null
  idempotency_key: string
  status: EmailSendStatus
  opened_at: string | null
  clicked_at: string | null
  bounced_at: string | null
  bounce_type: string | null
  error_message: string | null
  automation_run_id: string | null
  sent_at: string | null
  created_at: string
}

export interface SmsTemplate {
  id: string
  workspace_id: string
  name: string
  body: string
  variables: string[]
  is_archived: boolean
  created_at: string
  updated_at: string
}

export interface SmsCampaign {
  id: string
  workspace_id: string
  name: string
  body: string
  from_number: string
  template_id: string | null
  segment_id: string | null
  tag_ids: string[]
  exclude_tag_ids: string[]
  status: CampaignStatus
  scheduled_at: string | null
  started_at: string | null
  completed_at: string | null
  total_recipients: number
  total_sent: number
  total_delivered: number
  total_failed: number
  total_segments_used: number
  estimated_cost: number
  created_at: string
  updated_at: string
}

export interface SmsSend {
  id: string
  campaign_id: string | null
  contact_id: string
  workspace_id: string
  twilio_sid: string | null
  idempotency_key: string
  body: string
  from_number: string
  to_number: string
  status: SmsSendStatus
  segments: number
  cost: number | null
  error_code: string | null
  error_message: string | null
  automation_run_id: string | null
  sent_at: string | null
  delivered_at: string | null
  created_at: string
}

export interface Automation {
  id: string
  workspace_id: string
  name: string
  description: string | null
  trigger_type: TriggerType
  trigger_config: Record<string, unknown>
  steps: AutomationStep[]
  status: AutomationStatus
  total_enrolled: number
  total_completed: number
  total_errors: number
  allow_re_enrollment: boolean
  re_enrollment_delay_hours: number
  created_at: string
  updated_at: string
}

export interface AutomationRun {
  id: string
  automation_id: string
  contact_id: string
  workspace_id: string
  status: AutomationRunStatus
  current_step_index: number
  step_results: Record<string, unknown>[]
  error_message: string | null
  trigger_chain_depth: number
  started_at: string
  completed_at: string | null
  contact?: Contact
}

export interface AutomationWebhook {
  id: string
  workspace_id: string
  automation_id: string
  secret: string
  is_active: boolean
  last_triggered_at: string | null
  created_at: string
}

export interface SocialAccount {
  id: string
  workspace_id: string
  platform: SocialPlatform
  platform_id: string
  platform_name: string
  access_token: string
  token_expires_at: string | null
  profile_image_url: string | null
  is_active: boolean
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface SocialPost {
  id: string
  workspace_id: string
  content: string
  media_urls: string[]
  link_url: string | null
  account_ids: string[]
  status: SocialPostStatus
  scheduled_at: string | null
  published_at: string | null
  created_at: string
  updated_at: string
  results?: SocialPostResult[]
}

export interface SocialPostResult {
  id: string
  post_id: string
  social_account_id: string
  platform_post_id: string | null
  status: SocialPostResultStatus
  error_message: string | null
  likes: number
  comments: number
  shares: number
  reach: number
  published_at: string | null
  created_at: string
}

export interface UsageMonthly {
  id: string
  workspace_id: string
  month: string
  sms_sent: number
  sms_segments: number
  sms_cost: number
  emails_sent: number
  email_cost: number
  social_posts: number
  total_cost: number
}

export interface UnsubscribeEvent {
  id: string
  workspace_id: string
  contact_id: string
  channel: UnsubscribeChannel
  reason: string | null
  campaign_id: string | null
  created_at: string
}

export interface GlobalSuppression {
  id: string
  email: string | null
  phone: string | null
  reason: string
  created_at: string
}

export interface EventLog {
  id: string
  workspace_id: string
  event_type: string
  payload: Record<string, unknown>
  processed: boolean
  created_at: string
}

export interface JobQueue {
  id: string
  workspace_id: string
  job_type: JobType
  payload: Record<string, unknown>
  status: JobStatus
  priority: number
  execute_at: string
  started_at: string | null
  completed_at: string | null
  retry_count: number
  max_retries: number
  error: string | null
  idempotency_key: string | null
  created_at: string
}
