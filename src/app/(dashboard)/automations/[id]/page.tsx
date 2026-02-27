'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
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
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  ArrowLeft,
  Plus,
  Trash2,
  Mail,
  MessageSquare,
  Clock,
  GitBranch,
  Tag,
  Globe,
  Bell,
  Pencil,
  GripVertical,
  Save,
  Users,
  Settings,
  Play,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { Textarea } from '@/components/ui/textarea'

// ─── Types ──────────────────────────────────────────────────────────────────

interface Automation {
  id: string
  name: string
  status: string
  trigger_type: string
  trigger_config: Record<string, unknown>
  steps: Step[]
  allow_re_entry: boolean
  re_entry_delay: string | null
  created_at: string
  updated_at: string
}

interface Step {
  type: string
  config: Record<string, unknown>
}

interface AutomationRun {
  id: string
  contact_id: string
  status: string
  current_step: number
  started_at: string
  completed_at: string | null
  contacts?: { email: string; first_name: string | null; last_name: string | null }
}

// ─── Constants ──────────────────────────────────────────────────────────────

const STEP_TYPES = [
  { type: 'send_email', label: 'Send Email', icon: Mail, group: 'Actions' },
  { type: 'send_sms', label: 'Send SMS', icon: MessageSquare, group: 'Actions' },
  { type: 'webhook', label: 'Webhook', icon: Globe, group: 'Actions' },
  { type: 'wait', label: 'Wait / Delay', icon: Clock, group: 'Flow' },
  { type: 'condition', label: 'Condition', icon: GitBranch, group: 'Flow' },
  { type: 'add_tag', label: 'Add Tag', icon: Tag, group: 'Data' },
  { type: 'remove_tag', label: 'Remove Tag', icon: Tag, group: 'Data' },
  { type: 'update_field', label: 'Update Field', icon: Pencil, group: 'Data' },
  { type: 'notify', label: 'Notify Team', icon: Bell, group: 'Actions' },
]

const TRIGGER_LABELS: Record<string, string> = {
  contact_created: 'Contact Created',
  tag_added: 'Tag Added',
  tag_removed: 'Tag Removed',
  email_opened: 'Email Opened',
  email_clicked: 'Email Clicked',
  sms_delivered: 'SMS Delivered',
  webhook_received: 'Webhook Received',
  manual: 'Manual Enrollment',
}

// ─── Step summary ──────────────────────────────────────────────────────────

function StepSummary({ step }: { step: Step }) {
  const c = step.config
  switch (step.type) {
    case 'send_email':
      return <span>{(c.subject as string) || 'Untitled email'}</span>
    case 'send_sms':
      return <span>{((c.message as string) || '').slice(0, 60) || 'SMS message'}</span>
    case 'wait':
      return <span>Wait {(c.duration as string) || '—'}</span>
    case 'condition':
      return <span>If {(c.field as string) || '...'} {(c.operator as string) || '...'} {String(c.value ?? '')}</span>
    case 'add_tag':
      return <span>Add tag: {(c.tag_name as string) || (c.tag_id as string) || '—'}</span>
    case 'remove_tag':
      return <span>Remove tag: {(c.tag_name as string) || (c.tag_id as string) || '—'}</span>
    case 'update_field':
      return <span>Set {(c.field as string) || '...'} = {String(c.value ?? '...')}</span>
    case 'webhook':
      return <span>{(c.method as string) || 'POST'} {(c.url as string) || '—'}</span>
    case 'notify':
      return <span>{(c.message as string) || 'Notification'}</span>
    default:
      return <span>{step.type}</span>
  }
}

// ─── Step editor ───────────────────────────────────────────────────────────

function StepEditor({
  step,
  onChange,
}: {
  step: Step
  onChange: (config: Record<string, unknown>) => void
}) {
  const c = step.config

  switch (step.type) {
    case 'send_email':
      return (
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Subject</Label>
            <Input
              value={(c.subject as string) || ''}
              onChange={(e) => onChange({ ...c, subject: e.target.value })}
              placeholder="Email subject..."
            />
          </div>
          <div className="space-y-1">
            <Label>Body (HTML)</Label>
            <Textarea
              rows={4}
              value={(c.html_body as string) || ''}
              onChange={(e) => onChange({ ...c, html_body: e.target.value })}
              placeholder="<p>Hello {{first_name}},</p>..."
            />
          </div>
        </div>
      )

    case 'send_sms':
      return (
        <div className="space-y-1">
          <Label>Message</Label>
          <Textarea
            rows={3}
            value={(c.message as string) || ''}
            onChange={(e) => onChange({ ...c, message: e.target.value })}
            placeholder="Hi {{first_name}}..."
          />
        </div>
      )

    case 'wait':
      return (
        <div className="space-y-1">
          <Label>Duration</Label>
          <Select
            value={(c.duration as string) || '1h'}
            onValueChange={(v) => onChange({ ...c, duration: v })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="15m">15 minutes</SelectItem>
              <SelectItem value="30m">30 minutes</SelectItem>
              <SelectItem value="1h">1 hour</SelectItem>
              <SelectItem value="4h">4 hours</SelectItem>
              <SelectItem value="12h">12 hours</SelectItem>
              <SelectItem value="1d">1 day</SelectItem>
              <SelectItem value="3d">3 days</SelectItem>
              <SelectItem value="7d">7 days</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )

    case 'condition':
      return (
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Field</Label>
            <Input
              value={(c.field as string) || ''}
              onChange={(e) => onChange({ ...c, field: e.target.value })}
              placeholder="e.g. custom_fields.plan"
            />
          </div>
          <div className="space-y-1">
            <Label>Operator</Label>
            <Select
              value={(c.operator as string) || 'equals'}
              onValueChange={(v) => onChange({ ...c, operator: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="equals">equals</SelectItem>
                <SelectItem value="not_equals">not equals</SelectItem>
                <SelectItem value="contains">contains</SelectItem>
                <SelectItem value="exists">exists</SelectItem>
                <SelectItem value="has_tag">has tag</SelectItem>
                <SelectItem value="gt">greater than</SelectItem>
                <SelectItem value="lt">less than</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Value</Label>
            <Input
              value={String(c.value ?? '')}
              onChange={(e) => onChange({ ...c, value: e.target.value })}
              placeholder="Value to compare..."
            />
          </div>
          <p className="text-xs text-muted-foreground">
            YES branch steps and NO branch steps can be configured as sub-steps
            within the condition config (yes_steps / no_steps arrays).
          </p>
        </div>
      )

    case 'add_tag':
    case 'remove_tag':
      return (
        <div className="space-y-1">
          <Label>Tag Name</Label>
          <Input
            value={(c.tag_name as string) || ''}
            onChange={(e) => onChange({ ...c, tag_name: e.target.value })}
            placeholder="Tag name..."
          />
        </div>
      )

    case 'update_field':
      return (
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Field</Label>
            <Input
              value={(c.field as string) || ''}
              onChange={(e) => onChange({ ...c, field: e.target.value })}
              placeholder="e.g. custom_fields.score"
            />
          </div>
          <div className="space-y-1">
            <Label>Value</Label>
            <Input
              value={String(c.value ?? '')}
              onChange={(e) => onChange({ ...c, value: e.target.value })}
              placeholder="New value..."
            />
          </div>
        </div>
      )

    case 'webhook':
      return (
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Method</Label>
            <Select
              value={(c.method as string) || 'POST'}
              onValueChange={(v) => onChange({ ...c, method: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="POST">POST</SelectItem>
                <SelectItem value="GET">GET</SelectItem>
                <SelectItem value="PUT">PUT</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>URL</Label>
            <Input
              value={(c.url as string) || ''}
              onChange={(e) => onChange({ ...c, url: e.target.value })}
              placeholder="https://..."
            />
          </div>
        </div>
      )

    case 'notify':
      return (
        <div className="space-y-1">
          <Label>Message</Label>
          <Input
            value={(c.message as string) || ''}
            onChange={(e) => onChange({ ...c, message: e.target.value })}
            placeholder="Notification message..."
          />
        </div>
      )

    default:
      return <p className="text-sm text-muted-foreground">Unknown step type: {step.type}</p>
  }
}

// ─── Step icon helper ──────────────────────────────────────────────────────

function StepIcon({ type }: { type: string }) {
  const found = STEP_TYPES.find((s) => s.type === type)
  if (!found) return <Pencil className="h-4 w-4" />
  const Icon = found.icon
  return <Icon className="h-4 w-4" />
}

// ─── Run status badge ──────────────────────────────────────────────────────

function RunStatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'running':
      return <Badge className="bg-blue-100 text-blue-800 border-transparent">Running</Badge>
    case 'completed':
      return <Badge className="bg-green-100 text-green-800 border-transparent">Completed</Badge>
    case 'failed':
      return <Badge className="bg-red-100 text-red-800 border-transparent">Failed</Badge>
    case 'waiting':
      return <Badge className="bg-yellow-100 text-yellow-800 border-transparent">Waiting</Badge>
    case 'cancelled':
      return <Badge variant="secondary">Cancelled</Badge>
    default:
      return <Badge variant="outline">{status}</Badge>
  }
}

// ─── Main Page ─────────────────────────────────────────────────────────────

export default function AutomationDetailPage() {
  const params = useParams()
  const router = useRouter()
  const automationId = params.id as string

  const [automation, setAutomation] = useState<Automation | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [editingStep, setEditingStep] = useState<number | null>(null)
  const [showAddStep, setShowAddStep] = useState(false)
  const [showDelete, setShowDelete] = useState(false)

  // Runs tab
  const [runs, setRuns] = useState<AutomationRun[]>([])
  const [runsLoading, setRunsLoading] = useState(false)

  // Settings tab
  const [editName, setEditName] = useState('')
  const [editReEntry, setEditReEntry] = useState(false)
  const [editReEntryDelay, setEditReEntryDelay] = useState('24h')

  const fetchAutomation = useCallback(async () => {
    try {
      const res = await fetch(`/api/automations/${automationId}`)
      if (res.ok) {
        const data = await res.json()
        setAutomation(data)
        setEditName(data.name)
        setEditReEntry(data.allow_re_entry ?? false)
        setEditReEntryDelay(data.re_entry_delay || '24h')
      }
    } catch (err) {
      console.error('Failed to fetch automation:', err)
    } finally {
      setIsLoading(false)
    }
  }, [automationId])

  const fetchRuns = useCallback(async () => {
    setRunsLoading(true)
    try {
      const res = await fetch(`/api/automations/${automationId}/runs?limit=50`)
      if (res.ok) {
        const data = await res.json()
        setRuns(data.runs || [])
      }
    } catch (err) {
      console.error('Failed to fetch runs:', err)
    } finally {
      setRunsLoading(false)
    }
  }, [automationId])

  useEffect(() => {
    fetchAutomation()
  }, [fetchAutomation])

  // ─── Save helpers ──────────────────────────────────────────────────────

  async function saveSteps(steps: Step[]) {
    if (!automation) return
    setIsSaving(true)
    try {
      const res = await fetch(`/api/automations/${automationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ steps }),
      })
      if (res.ok) {
        const data = await res.json()
        setAutomation(data)
      }
    } catch (err) {
      console.error('Failed to save steps:', err)
    } finally {
      setIsSaving(false)
    }
  }

  async function saveSettings() {
    setIsSaving(true)
    try {
      const res = await fetch(`/api/automations/${automationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editName.trim(),
          allow_re_entry: editReEntry,
          re_entry_delay: editReEntry ? editReEntryDelay : null,
        }),
      })
      if (res.ok) {
        const data = await res.json()
        setAutomation(data)
      }
    } catch (err) {
      console.error('Failed to save settings:', err)
    } finally {
      setIsSaving(false)
    }
  }

  async function toggleStatus() {
    if (!automation) return
    const newStatus = automation.status === 'active' ? 'paused' : 'active'
    try {
      const res = await fetch(`/api/automations/${automationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      if (res.ok) {
        const data = await res.json()
        setAutomation(data)
      }
    } catch (err) {
      console.error('Failed to toggle status:', err)
    }
  }

  async function deleteAutomation() {
    try {
      const res = await fetch(`/api/automations/${automationId}`, { method: 'DELETE' })
      if (res.ok) {
        router.push('/automations')
      }
    } catch (err) {
      console.error('Failed to delete:', err)
    }
  }

  // ─── Step manipulation helpers ─────────────────────────────────────────

  function addStep(type: string) {
    if (!automation) return
    const newStep: Step = { type, config: {} }
    const steps = [...automation.steps, newStep]
    setAutomation({ ...automation, steps })
    saveSteps(steps)
    setShowAddStep(false)
    setEditingStep(steps.length - 1)
  }

  function updateStepConfig(index: number, config: Record<string, unknown>) {
    if (!automation) return
    const steps = automation.steps.map((s, i) => (i === index ? { ...s, config } : s))
    setAutomation({ ...automation, steps })
  }

  function saveCurrentStep() {
    if (!automation || editingStep === null) return
    saveSteps(automation.steps)
    setEditingStep(null)
  }

  function removeStep(index: number) {
    if (!automation) return
    const steps = automation.steps.filter((_, i) => i !== index)
    setAutomation({ ...automation, steps })
    saveSteps(steps)
    if (editingStep === index) setEditingStep(null)
  }

  function moveStep(index: number, direction: 'up' | 'down') {
    if (!automation) return
    const steps = [...automation.steps]
    const target = direction === 'up' ? index - 1 : index + 1
    if (target < 0 || target >= steps.length) return
    ;[steps[index], steps[target]] = [steps[target], steps[index]]
    setAutomation({ ...automation, steps })
    saveSteps(steps)
    if (editingStep === index) setEditingStep(target)
  }

  // ─── Loading state ────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-[400px] w-full" />
      </div>
    )
  }

  if (!automation) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Automation not found</h1>
        <Link href="/automations">
          <Button variant="outline">Back to Automations</Button>
        </Link>
      </div>
    )
  }

  // ─── Render ───────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/automations">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">{automation.name}</h1>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="outline">
                {TRIGGER_LABELS[automation.trigger_type] || automation.trigger_type}
              </Badge>
              <Badge
                className={
                  automation.status === 'active'
                    ? 'bg-green-100 text-green-800 border-transparent'
                    : automation.status === 'paused'
                      ? 'bg-orange-100 text-orange-800 border-transparent'
                      : ''
                }
                variant={automation.status === 'draft' ? 'secondary' : 'default'}
              >
                {automation.status.charAt(0).toUpperCase() + automation.status.slice(1)}
              </Badge>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {automation.status !== 'draft' && (
            <Button variant="outline" onClick={toggleStatus}>
              {automation.status === 'active' ? 'Pause' : 'Activate'}
            </Button>
          )}
          {automation.status === 'draft' && automation.steps.length > 0 && (
            <Button onClick={toggleStatus}>
              <Play className="mr-2 h-4 w-4" />
              Activate
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="builder" onValueChange={(v) => { if (v === 'runs') fetchRuns() }}>
        <TabsList>
          <TabsTrigger value="builder">Builder</TabsTrigger>
          <TabsTrigger value="runs">
            <Users className="mr-1 h-3.5 w-3.5" />
            Runs
          </TabsTrigger>
          <TabsTrigger value="settings">
            <Settings className="mr-1 h-3.5 w-3.5" />
            Settings
          </TabsTrigger>
        </TabsList>

        {/* ── Builder Tab ────────────────────────────────────────────── */}
        <TabsContent value="builder" className="space-y-4 mt-4">
          {automation.steps.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground mb-4">No steps yet. Add your first step to build the automation.</p>
                <Dialog open={showAddStep} onOpenChange={setShowAddStep}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="mr-2 h-4 w-4" />
                      Add First Step
                    </Button>
                  </DialogTrigger>
                  <AddStepDialogContent onSelect={addStep} />
                </Dialog>
              </CardContent>
            </Card>
          ) : (
            <>
              {automation.steps.map((step, index) => (
                <Card
                  key={index}
                  className={editingStep === index ? 'ring-2 ring-primary' : ''}
                >
                  <CardContent className="py-4">
                    <div className="flex items-start gap-3">
                      <div className="flex flex-col items-center gap-1 pt-1">
                        <button
                          onClick={() => moveStep(index, 'up')}
                          disabled={index === 0}
                          className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                        >
                          <ChevronUp className="h-3.5 w-3.5" />
                        </button>
                        <GripVertical className="h-4 w-4 text-muted-foreground" />
                        <button
                          onClick={() => moveStep(index, 'down')}
                          disabled={index === automation.steps.length - 1}
                          className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                        >
                          <ChevronDown className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <div className="flex items-center gap-2 text-sm font-medium">
                            <StepIcon type={step.type} />
                            <span className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded">
                              {index + 1}
                            </span>
                            {STEP_TYPES.find((s) => s.type === step.type)?.label || step.type}
                          </div>
                        </div>

                        {editingStep === index ? (
                          <div className="mt-3 space-y-3">
                            <StepEditor
                              step={step}
                              onChange={(config) => updateStepConfig(index, config)}
                            />
                            <div className="flex gap-2">
                              <Button size="sm" onClick={saveCurrentStep} disabled={isSaving}>
                                <Save className="mr-1 h-3.5 w-3.5" />
                                {isSaving ? 'Saving...' : 'Save'}
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => setEditingStep(null)}>
                                Cancel
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">
                            <StepSummary step={step} />
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-1">
                        {editingStep !== index && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => setEditingStep(index)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          onClick={() => removeStep(index)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}

              <Dialog open={showAddStep} onOpenChange={setShowAddStep}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="w-full border-dashed">
                    <Plus className="mr-2 h-4 w-4" />
                    Add Step
                  </Button>
                </DialogTrigger>
                <AddStepDialogContent onSelect={addStep} />
              </Dialog>
            </>
          )}
        </TabsContent>

        {/* ── Runs Tab ───────────────────────────────────────────────── */}
        <TabsContent value="runs" className="mt-4">
          {runsLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : runs.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Users className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
                <p className="text-muted-foreground">No runs yet. Activate the automation to start enrolling contacts.</p>
              </CardContent>
            </Card>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Contact</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Current Step</TableHead>
                  <TableHead>Started</TableHead>
                  <TableHead>Completed</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {runs.map((run) => (
                  <TableRow key={run.id}>
                    <TableCell>
                      {run.contacts ? (
                        <Link href={`/contacts/${run.contact_id}`} className="hover:underline">
                          {[run.contacts.first_name, run.contacts.last_name].filter(Boolean).join(' ') || run.contacts.email}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">{run.contact_id.slice(0, 8)}...</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <RunStatusBadge status={run.status} />
                    </TableCell>
                    <TableCell>{run.current_step + 1}</TableCell>
                    <TableCell>{new Date(run.started_at).toLocaleString()}</TableCell>
                    <TableCell>
                      {run.completed_at ? new Date(run.completed_at).toLocaleString() : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </TabsContent>

        {/* ── Settings Tab ───────────────────────────────────────────── */}
        <TabsContent value="settings" className="mt-4 space-y-6 max-w-2xl">
          <Card>
            <CardHeader>
              <CardTitle>General</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="settings-name">Name</Label>
                <Input
                  id="settings-name"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                />
              </div>
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div>
                  <Label>Allow Re-entry</Label>
                  <p className="text-sm text-muted-foreground">
                    Allow contacts to go through this automation more than once.
                  </p>
                </div>
                <Switch checked={editReEntry} onCheckedChange={setEditReEntry} />
              </div>
              {editReEntry && (
                <div className="space-y-2">
                  <Label>Re-entry Delay</Label>
                  <Select value={editReEntryDelay} onValueChange={setEditReEntryDelay}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1h">1 hour</SelectItem>
                      <SelectItem value="12h">12 hours</SelectItem>
                      <SelectItem value="24h">24 hours</SelectItem>
                      <SelectItem value="3d">3 days</SelectItem>
                      <SelectItem value="7d">7 days</SelectItem>
                      <SelectItem value="30d">30 days</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              <Button onClick={saveSettings} disabled={isSaving}>
                <Save className="mr-2 h-4 w-4" />
                {isSaving ? 'Saving...' : 'Save Settings'}
              </Button>
            </CardContent>
          </Card>

          {/* Danger Zone */}
          <Card className="border-destructive/50">
            <CardHeader>
              <CardTitle className="text-destructive">Danger Zone</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Deleting this automation will cancel all running instances and cannot be undone.
              </p>
              <Dialog open={showDelete} onOpenChange={setShowDelete}>
                <DialogTrigger asChild>
                  <Button variant="destructive">
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete Automation
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Delete Automation</DialogTitle>
                    <DialogDescription>
                      Are you sure you want to delete &quot;{automation.name}&quot;? This will cancel
                      all running instances and cannot be undone.
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setShowDelete(false)}>
                      Cancel
                    </Button>
                    <Button variant="destructive" onClick={deleteAutomation}>
                      Delete
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

// ─── Add step dialog content ───────────────────────────────────────────────

function AddStepDialogContent({ onSelect }: { onSelect: (type: string) => void }) {
  const groups = ['Actions', 'Flow', 'Data'] as const
  return (
    <DialogContent className="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>Add Step</DialogTitle>
        <DialogDescription>Choose the type of step to add to your automation.</DialogDescription>
      </DialogHeader>
      <div className="space-y-4 py-2">
        {groups.map((group) => {
          const items = STEP_TYPES.filter((s) => s.group === group)
          return (
            <div key={group}>
              <p className="text-xs font-medium text-muted-foreground mb-2">{group}</p>
              <div className="grid grid-cols-3 gap-2">
                {items.map((item) => {
                  const Icon = item.icon
                  return (
                    <button
                      key={item.type}
                      onClick={() => onSelect(item.type)}
                      className="flex flex-col items-center gap-1.5 rounded-lg border p-3 text-sm hover:bg-accent transition-colors"
                    >
                      <Icon className="h-5 w-5" />
                      <span className="text-xs text-center">{item.label}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </DialogContent>
  )
}
