'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  ChevronLeft,
  ChevronRight,
  Send,
  Clock,
  Check,
  AlertCircle,
  Loader2,
  FlaskConical,
  MessageSquare,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { useWorkspace } from '@/lib/hooks/use-workspace'
import { useSMSCounter } from '@/lib/hooks/use-sms-counter'
import type { SmsTemplate, Tag, Segment } from '@/lib/types'

const STEPS = [
  { number: 1, label: 'Setup' },
  { number: 2, label: 'Content' },
  { number: 3, label: 'Recipients' },
  { number: 4, label: 'Schedule' },
  { number: 5, label: 'Review' },
]

const MERGE_TAGS = [
  { label: 'First Name', tag: '{{first_name}}' },
  { label: 'Last Name', tag: '{{last_name}}' },
  { label: 'Full Name', tag: '{{full_name}}' },
  { label: 'Company', tag: '{{company_name}}' },
]

interface FormData {
  name: string
  from_number: string
  body: string
  template_id: string
  recipient_type: 'all' | 'tags' | 'segment'
  tag_ids: string[]
  segment_id: string
  exclude_tag_ids: string[]
  schedule_type: 'now' | 'later'
  schedule_date: string
  schedule_time: string
  schedule_timezone: string
}

export default function NewSmsCampaignPage() {
  const router = useRouter()
  useWorkspace()
  const bodyTextareaRef = useRef<HTMLTextAreaElement>(null)

  const [currentStep, setCurrentStep] = useState(1)
  const [isSending, setIsSending] = useState(false)
  const [showTestDialog, setShowTestDialog] = useState(false)
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [testPhone, setTestPhone] = useState('')
  const [testSending, setTestSending] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)

  const [templates, setTemplates] = useState<SmsTemplate[]>([])
  const [tags, setTags] = useState<Tag[]>([])
  const [segments, setSegments] = useState<Segment[]>([])
  const [recipientCount, setRecipientCount] = useState<number | null>(null)
  const [countLoading, setCountLoading] = useState(false)

  const [form, setForm] = useState<FormData>({
    name: '',
    from_number: '',
    body: '',
    template_id: '',
    recipient_type: 'all',
    tag_ids: [],
    segment_id: '',
    exclude_tag_ids: [],
    schedule_type: 'now',
    schedule_date: '',
    schedule_time: '09:00',
    schedule_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  })

  const segmentInfo = useSMSCounter(form.body)

  // Fetch templates
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/templates/sms')
        if (res.ok) {
          const data = await res.json()
          setTemplates(data)
        }
      } catch (err) {
        console.error('Failed to load templates:', err)
      }
    }
    load()
  }, [])

  // Fetch tags
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/tags')
        if (res.ok) {
          const data = await res.json()
          setTags(data)
        }
      } catch (err) {
        console.error('Failed to load tags:', err)
      }
    }
    load()
  }, [])

  // Fetch segments
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/segments')
        if (res.ok) {
          const data = await res.json()
          setSegments(data)
        }
      } catch (err) {
        console.error('Failed to load segments:', err)
      }
    }
    load()
  }, [])

  // Fetch recipient count when recipients step is active
  const fetchRecipientCount = useCallback(async () => {
    setCountLoading(true)
    try {
      const res = await fetch('/api/campaigns/sms/count', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipient_type: form.recipient_type,
          tag_ids: form.tag_ids,
          segment_id: form.segment_id,
          exclude_tag_ids: form.exclude_tag_ids,
        }),
      })
      if (res.ok) {
        const data = await res.json()
        setRecipientCount(data.count)
      }
    } catch (err) {
      console.error('Failed to get count:', err)
    } finally {
      setCountLoading(false)
    }
  }, [form.recipient_type, form.tag_ids, form.segment_id, form.exclude_tag_ids])

  useEffect(() => {
    if (currentStep === 3) {
      fetchRecipientCount()
    }
  }, [currentStep, fetchRecipientCount])

  function updateForm(updates: Partial<FormData>) {
    setForm((prev) => ({ ...prev, ...updates }))
  }

  function handleTemplateSelect(templateId: string) {
    if (templateId === 'blank') {
      updateForm({ template_id: '', body: '' })
      return
    }
    const template = templates.find((t) => t.id === templateId)
    if (template) {
      updateForm({
        template_id: template.id,
        body: template.body || form.body,
      })
    }
  }

  function insertBodyMergeTag(tag: string) {
    const textarea = bodyTextareaRef.current
    if (!textarea) return
    const start = textarea.selectionStart || 0
    const end = textarea.selectionEnd || 0
    const before = form.body.slice(0, start)
    const after = form.body.slice(end)
    updateForm({ body: before + tag + after })
    requestAnimationFrame(() => {
      textarea.focus()
      const pos = start + tag.length
      textarea.setSelectionRange(pos, pos)
    })
  }

  function toggleTagId(tagId: string, field: 'tag_ids' | 'exclude_tag_ids') {
    setForm((prev) => {
      const current = prev[field]
      const next = current.includes(tagId)
        ? current.filter((id) => id !== tagId)
        : [...current, tagId]
      return { ...prev, [field]: next }
    })
  }

  async function handleSendTest() {
    if (!testPhone) return
    setTestSending(true)
    setTestResult(null)
    try {
      const res = await fetch('/api/campaigns/sms/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to_phone: testPhone,
          body: form.body,
          from_number: form.from_number,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        setTestResult({ success: true, message: 'Test SMS sent successfully!' })
      } else {
        setTestResult({ success: false, message: data.error || 'Failed to send test SMS' })
      }
    } catch {
      setTestResult({ success: false, message: 'Network error sending test SMS' })
    } finally {
      setTestSending(false)
    }
  }

  async function handleConfirmSend() {
    setIsSending(true)
    try {
      // Create the campaign
      const campaignPayload = {
        name: form.name,
        body: form.body,
        from_number: form.from_number || null,
        template_id: form.template_id || null,
        segment_id: form.recipient_type === 'segment' ? form.segment_id : null,
        tag_ids: form.recipient_type === 'tags' ? form.tag_ids : [],
        exclude_tag_ids: form.exclude_tag_ids,
        status: form.schedule_type === 'later' ? 'scheduled' : 'draft',
        scheduled_at:
          form.schedule_type === 'later' && form.schedule_date
            ? new Date(`${form.schedule_date}T${form.schedule_time}`).toISOString()
            : null,
        total_recipients: recipientCount || 0,
      }

      const createRes = await fetch('/api/campaigns/sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(campaignPayload),
      })

      if (!createRes.ok) {
        const err = await createRes.json()
        throw new Error(err.error || 'Failed to create campaign')
      }

      const campaign = await createRes.json()

      // If sending now, trigger the send
      if (form.schedule_type === 'now') {
        const sendRes = await fetch(`/api/campaigns/sms/${campaign.id}/send`, {
          method: 'POST',
        })
        if (!sendRes.ok) {
          const err = await sendRes.json()
          throw new Error(err.error || 'Failed to trigger send')
        }
      }

      router.push(`/campaigns/sms/${campaign.id}`)
    } catch (err) {
      console.error('Campaign creation error:', err)
      alert(err instanceof Error ? err.message : 'Failed to create campaign')
    } finally {
      setIsSending(false)
      setShowConfirmDialog(false)
    }
  }

  function canProceed(): boolean {
    switch (currentStep) {
      case 1:
        return form.name.trim().length > 0
      case 2:
        return form.body.trim().length > 0
      case 3:
        if (form.recipient_type === 'tags' && form.tag_ids.length === 0) return false
        if (form.recipient_type === 'segment' && !form.segment_id) return false
        return true
      case 4:
        if (form.schedule_type === 'later' && !form.schedule_date) return false
        return true
      default:
        return true
    }
  }

  const estimatedTotalCost = (recipientCount || 0) * segmentInfo.segmentCount * 0.0079

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold">New SMS Campaign</h1>
        <p className="text-muted-foreground mt-1">
          Create and send an SMS campaign to your contacts.
        </p>
      </div>

      {/* Step Indicator */}
      <div className="flex items-center gap-2">
        {STEPS.map((step, idx) => (
          <div key={step.number} className="flex items-center">
            <button
              type="button"
              onClick={() => {
                if (step.number < currentStep) setCurrentStep(step.number)
              }}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                step.number === currentStep
                  ? 'bg-primary text-primary-foreground'
                  : step.number < currentStep
                    ? 'bg-primary/10 text-primary cursor-pointer'
                    : 'bg-muted text-muted-foreground'
              }`}
            >
              <span
                className={`flex items-center justify-center h-6 w-6 rounded-full text-xs ${
                  step.number < currentStep
                    ? 'bg-primary text-primary-foreground'
                    : step.number === currentStep
                      ? 'bg-primary-foreground text-primary'
                      : 'bg-muted-foreground/20 text-muted-foreground'
                }`}
              >
                {step.number < currentStep ? (
                  <Check className="h-3.5 w-3.5" />
                ) : (
                  step.number
                )}
              </span>
              {step.label}
            </button>
            {idx < STEPS.length - 1 && (
              <div className="w-8 h-px bg-border mx-1" />
            )}
          </div>
        ))}
      </div>

      {/* Step 1: Setup */}
      {currentStep === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Campaign Setup</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="campaign-name">Campaign Name *</Label>
              <Input
                id="campaign-name"
                placeholder="e.g., Flash Sale Announcement"
                value={form.name}
                onChange={(e) => updateForm({ name: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="from-number">From Number</Label>
              <Input
                id="from-number"
                placeholder="Leave blank to use workspace default"
                value={form.from_number}
                onChange={(e) => updateForm({ from_number: e.target.value })}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Content */}
      {currentStep === 2 && (
        <Card>
          <CardHeader>
            <CardTitle>SMS Content</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Template Picker */}
            <div className="space-y-1.5">
              <Label>Template</Label>
              <Select
                value={form.template_id || 'blank'}
                onValueChange={handleTemplateSelect}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a template..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="blank">Blank</SelectItem>
                  {templates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* SMS Body */}
            <div className="space-y-1.5">
              <Label htmlFor="sms-body">Message *</Label>
              <Textarea
                ref={bodyTextareaRef}
                id="sms-body"
                placeholder="Enter your SMS message..."
                value={form.body}
                onChange={(e) => updateForm({ body: e.target.value })}
                rows={6}
                className="resize-y"
              />
              <div className="flex flex-wrap gap-1">
                {MERGE_TAGS.map((item) => (
                  <Button
                    key={item.tag}
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-6 text-xs"
                    onClick={() => insertBodyMergeTag(item.tag)}
                  >
                    {item.label}
                  </Button>
                ))}
              </div>
            </div>

            {/* SMS Counter */}
            <div
              className={`text-sm font-mono ${
                segmentInfo.warningLevel === 'red'
                  ? 'text-red-600'
                  : segmentInfo.warningLevel === 'yellow'
                    ? 'text-amber-600'
                    : 'text-muted-foreground'
              }`}
            >
              {segmentInfo.charCount} chars | {segmentInfo.segmentCount} segment(s) | {segmentInfo.encoding} | ~${segmentInfo.costEstimate.toFixed(4)}/msg
            </div>

            {/* Send Test */}
            <div className="flex justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setTestResult(null)
                  setShowTestDialog(true)
                }}
              >
                <FlaskConical className="mr-2 h-4 w-4" />
                Send Test SMS
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Recipients */}
      {currentStep === 3 && (
        <Card>
          <CardHeader>
            <CardTitle>Recipients</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <RadioGroup
              value={form.recipient_type}
              onValueChange={(val: 'all' | 'tags' | 'segment') =>
                updateForm({ recipient_type: val })
              }
            >
              {/* All contacts */}
              <div className="flex items-center space-x-3 rounded-md border p-4">
                <RadioGroupItem value="all" id="recipient-all" />
                <Label htmlFor="recipient-all" className="cursor-pointer flex-1">
                  <div className="font-medium">All active contacts</div>
                  <div className="text-sm text-muted-foreground">
                    Send to every active contact with a valid phone number
                  </div>
                </Label>
              </div>

              {/* Tags */}
              <div className="rounded-md border p-4 space-y-3">
                <div className="flex items-center space-x-3">
                  <RadioGroupItem value="tags" id="recipient-tags" />
                  <Label htmlFor="recipient-tags" className="cursor-pointer flex-1">
                    <div className="font-medium">Contacts with specific tags</div>
                    <div className="text-sm text-muted-foreground">
                      Only send to contacts that have one or more of the selected tags
                    </div>
                  </Label>
                </div>
                {form.recipient_type === 'tags' && (
                  <div className="pl-7">
                    <TagMultiSelect
                      tags={tags}
                      selectedIds={form.tag_ids}
                      onToggle={(id) => toggleTagId(id, 'tag_ids')}
                      placeholder="Select tags..."
                    />
                  </div>
                )}
              </div>

              {/* Segment */}
              <div className="rounded-md border p-4 space-y-3">
                <div className="flex items-center space-x-3">
                  <RadioGroupItem value="segment" id="recipient-segment" />
                  <Label htmlFor="recipient-segment" className="cursor-pointer flex-1">
                    <div className="font-medium">Saved segment</div>
                    <div className="text-sm text-muted-foreground">
                      Use a pre-defined segment to target specific contacts
                    </div>
                  </Label>
                </div>
                {form.recipient_type === 'segment' && (
                  <div className="pl-7">
                    <Select
                      value={form.segment_id}
                      onValueChange={(val) => updateForm({ segment_id: val })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a segment..." />
                      </SelectTrigger>
                      <SelectContent>
                        {segments.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.name} ({s.contact_count} contacts)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            </RadioGroup>

            {/* Exclude Tags */}
            <div className="space-y-2">
              <Label>Exclude contacts with tags (optional)</Label>
              <TagMultiSelect
                tags={tags}
                selectedIds={form.exclude_tag_ids}
                onToggle={(id) => toggleTagId(id, 'exclude_tag_ids')}
                placeholder="Select tags to exclude..."
              />
            </div>

            {/* Recipient Count */}
            <div
              className={`rounded-md p-4 ${
                recipientCount === 0
                  ? 'bg-destructive/10 border-destructive/20 border'
                  : 'bg-muted'
              }`}
            >
              {countLoading ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Counting recipients...
                </div>
              ) : recipientCount !== null ? (
                <div className="flex items-center gap-2">
                  {recipientCount === 0 ? (
                    <>
                      <AlertCircle className="h-4 w-4 text-destructive" />
                      <span className="font-medium text-destructive">
                        No contacts match your selection
                      </span>
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4 text-green-600" />
                      <span className="font-medium">
                        {recipientCount.toLocaleString()} contacts will receive this SMS
                      </span>
                    </>
                  )}
                </div>
              ) : null}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 4: Schedule */}
      {currentStep === 4 && (
        <Card>
          <CardHeader>
            <CardTitle>Schedule</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <RadioGroup
              value={form.schedule_type}
              onValueChange={(val: 'now' | 'later') =>
                updateForm({ schedule_type: val })
              }
            >
              <div className="flex items-center space-x-3 rounded-md border p-4">
                <RadioGroupItem value="now" id="schedule-now" />
                <Label htmlFor="schedule-now" className="cursor-pointer flex-1">
                  <div className="flex items-center gap-2 font-medium">
                    <Send className="h-4 w-4" />
                    Send now
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Start sending immediately after confirmation
                  </div>
                </Label>
              </div>
              <div className="rounded-md border p-4 space-y-3">
                <div className="flex items-center space-x-3">
                  <RadioGroupItem value="later" id="schedule-later" />
                  <Label htmlFor="schedule-later" className="cursor-pointer flex-1">
                    <div className="flex items-center gap-2 font-medium">
                      <Clock className="h-4 w-4" />
                      Schedule for later
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Choose a date and time to send
                    </div>
                  </Label>
                </div>
                {form.schedule_type === 'later' && (
                  <div className="pl-7 grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="schedule-date">Date</Label>
                      <Input
                        id="schedule-date"
                        type="date"
                        value={form.schedule_date}
                        onChange={(e) => updateForm({ schedule_date: e.target.value })}
                        min={new Date().toISOString().split('T')[0]}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="schedule-time">Time</Label>
                      <Input
                        id="schedule-time"
                        type="time"
                        value={form.schedule_time}
                        onChange={(e) => updateForm({ schedule_time: e.target.value })}
                      />
                    </div>
                    <div className="col-span-2 text-sm text-muted-foreground">
                      Timezone: {form.schedule_timezone}
                    </div>
                  </div>
                )}
              </div>
            </RadioGroup>
          </CardContent>
        </Card>
      )}

      {/* Step 5: Review */}
      {currentStep === 5 && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Review Campaign</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                <div>
                  <dt className="text-muted-foreground">Campaign Name</dt>
                  <dd className="font-medium">{form.name}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">From Number</dt>
                  <dd className="font-medium">
                    {form.from_number || 'Workspace default'}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Recipients</dt>
                  <dd className="font-medium">
                    {recipientCount !== null
                      ? `${recipientCount.toLocaleString()} contacts`
                      : 'Calculating...'}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Segments per message</dt>
                  <dd className="font-medium">
                    {segmentInfo.segmentCount} segment{segmentInfo.segmentCount !== 1 ? 's' : ''} ({segmentInfo.encoding})
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Schedule</dt>
                  <dd className="font-medium">
                    {form.schedule_type === 'now'
                      ? 'Send immediately'
                      : `${form.schedule_date} at ${form.schedule_time} (${form.schedule_timezone})`}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Estimated total cost</dt>
                  <dd className="font-medium">
                    ~${estimatedTotalCost.toFixed(2)}
                  </dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          {/* Message Preview */}
          <Card>
            <CardHeader>
              <CardTitle>Message Preview</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border bg-muted/30 p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                    <MessageSquare className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="text-xs text-muted-foreground">
                      From: {form.from_number || 'Workspace default'}
                    </div>
                    <div className="rounded-lg bg-muted p-3 text-sm whitespace-pre-wrap">
                      {form.body || '(empty message)'}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {segmentInfo.charCount} chars &middot; {segmentInfo.segmentCount} segment{segmentInfo.segmentCount !== 1 ? 's' : ''}
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between pt-4 border-t">
        <div>
          {currentStep > 1 && (
            <Button
              type="button"
              variant="outline"
              onClick={() => setCurrentStep((s) => s - 1)}
            >
              <ChevronLeft className="mr-1 h-4 w-4" />
              Back
            </Button>
          )}
        </div>
        <div className="flex gap-2">
          {currentStep < 5 && (
            <Button
              type="button"
              onClick={() => setCurrentStep((s) => s + 1)}
              disabled={!canProceed()}
            >
              Next
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          )}
          {currentStep === 5 && (
            <Button
              type="button"
              onClick={() => setShowConfirmDialog(true)}
              disabled={isSending}
            >
              {isSending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {form.schedule_type === 'now' ? (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Send Campaign
                </>
              ) : (
                <>
                  <Clock className="mr-2 h-4 w-4" />
                  Schedule Campaign
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Test SMS Dialog */}
      <Dialog open={showTestDialog} onOpenChange={setShowTestDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send Test SMS</DialogTitle>
            <DialogDescription>
              Send a test version of this SMS to verify how it looks.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="test-phone">Phone number</Label>
              <Input
                id="test-phone"
                type="tel"
                placeholder="+1234567890"
                value={testPhone}
                onChange={(e) => setTestPhone(e.target.value)}
              />
            </div>
            {testResult && (
              <div
                className={`rounded-md p-3 text-sm ${
                  testResult.success
                    ? 'bg-green-50 text-green-800'
                    : 'bg-destructive/10 text-destructive'
                }`}
              >
                {testResult.message}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTestDialog(false)}>
              Close
            </Button>
            <Button onClick={handleSendTest} disabled={!testPhone || testSending}>
              {testSending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Send Test
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm Send Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {form.schedule_type === 'now' ? 'Send Campaign?' : 'Schedule Campaign?'}
            </DialogTitle>
            <DialogDescription>
              {form.schedule_type === 'now'
                ? `This will immediately start sending ${
                    recipientCount?.toLocaleString() || 0
                  } SMS messages (~$${estimatedTotalCost.toFixed(2)}). This action cannot be undone.`
                : `This campaign will be sent on ${form.schedule_date} at ${form.schedule_time}.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowConfirmDialog(false)}
              disabled={isSending}
            >
              Cancel
            </Button>
            <Button onClick={handleConfirmSend} disabled={isSending}>
              {isSending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {form.schedule_type === 'now' ? 'Yes, Send Now' : 'Yes, Schedule'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// Tag multi-select with Popover + Checkboxes
function TagMultiSelect({
  tags,
  selectedIds,
  onToggle,
  placeholder,
}: {
  tags: Tag[]
  selectedIds: string[]
  onToggle: (id: string) => void
  placeholder: string
}) {
  const [open, setOpen] = useState(false)

  const selectedTags = tags.filter((t) => selectedIds.includes(t.id))

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="w-full justify-start font-normal h-auto min-h-10">
          {selectedTags.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {selectedTags.map((t) => (
                <Badge key={t.id} variant="secondary" className="text-xs">
                  {t.name}
                </Badge>
              ))}
            </div>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2" align="start">
        <div className="space-y-1 max-h-60 overflow-auto">
          {tags.length === 0 ? (
            <p className="text-sm text-muted-foreground p-2">No tags available</p>
          ) : (
            tags.map((tag) => (
              <label
                key={tag.id}
                className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted cursor-pointer text-sm"
              >
                <Checkbox
                  checked={selectedIds.includes(tag.id)}
                  onCheckedChange={() => onToggle(tag.id)}
                />
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: tag.color || '#6b7280' }}
                />
                {tag.name}
                {tag.contact_count != null && (
                  <span className="ml-auto text-muted-foreground text-xs">
                    {tag.contact_count}
                  </span>
                )}
              </label>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
