'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
  Save,
  Users,
  Settings,
  Play,
  Pause,
  ChevronDown,
  ChevronUp,
  Zap,
  CheckCircle2,
  XCircle,
  Loader2,
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
  { type: 'send_email', label: 'Send Email', icon: Mail, group: 'Actions', color: 'text-blue-400', bg: 'bg-blue-500/10' },
  { type: 'send_sms', label: 'Send SMS', icon: MessageSquare, group: 'Actions', color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  { type: 'webhook', label: 'Webhook', icon: Globe, group: 'Actions', color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
  { type: 'wait', label: 'Wait / Delay', icon: Clock, group: 'Flow', color: 'text-amber-400', bg: 'bg-amber-500/10' },
  { type: 'condition', label: 'Condition', icon: GitBranch, group: 'Flow', color: 'text-purple-400', bg: 'bg-purple-500/10' },
  { type: 'add_tag', label: 'Add Tag', icon: Tag, group: 'Data', color: 'text-pink-400', bg: 'bg-pink-500/10' },
  { type: 'remove_tag', label: 'Remove Tag', icon: Tag, group: 'Data', color: 'text-orange-400', bg: 'bg-orange-500/10' },
  { type: 'update_field', label: 'Update Field', icon: Pencil, group: 'Data', color: 'text-indigo-400', bg: 'bg-indigo-500/10' },
  { type: 'notify', label: 'Notify Team', icon: Bell, group: 'Actions', color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
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
            <Label className="text-slate-400">Subject</Label>
            <Input
              value={(c.subject as string) || ''}
              onChange={(e) => onChange({ ...c, subject: e.target.value })}
              placeholder="Email subject..."
              className="border-slate-700 bg-slate-800/50"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-slate-400">Body (HTML)</Label>
            <Textarea
              rows={4}
              value={(c.html_body as string) || ''}
              onChange={(e) => onChange({ ...c, html_body: e.target.value })}
              placeholder="<p>Hello {{first_name}},</p>..."
              className="border-slate-700 bg-slate-800/50"
            />
          </div>
        </div>
      )

    case 'send_sms':
      return (
        <div className="space-y-1">
          <Label className="text-slate-400">Message</Label>
          <Textarea
            rows={3}
            value={(c.message as string) || ''}
            onChange={(e) => onChange({ ...c, message: e.target.value })}
            placeholder="Hi {{first_name}}..."
            className="border-slate-700 bg-slate-800/50"
          />
        </div>
      )

    case 'wait':
      return (
        <div className="space-y-1">
          <Label className="text-slate-400">Duration</Label>
          <Select
            value={(c.duration as string) || '1h'}
            onValueChange={(v) => onChange({ ...c, duration: v })}
          >
            <SelectTrigger className="border-slate-700 bg-slate-800/50">
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
            <Label className="text-slate-400">Field</Label>
            <Input
              value={(c.field as string) || ''}
              onChange={(e) => onChange({ ...c, field: e.target.value })}
              placeholder="e.g. custom_fields.plan"
              className="border-slate-700 bg-slate-800/50"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-slate-400">Operator</Label>
            <Select
              value={(c.operator as string) || 'equals'}
              onValueChange={(v) => onChange({ ...c, operator: v })}
            >
              <SelectTrigger className="border-slate-700 bg-slate-800/50">
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
            <Label className="text-slate-400">Value</Label>
            <Input
              value={String(c.value ?? '')}
              onChange={(e) => onChange({ ...c, value: e.target.value })}
              placeholder="Value to compare..."
              className="border-slate-700 bg-slate-800/50"
            />
          </div>
        </div>
      )

    case 'add_tag':
    case 'remove_tag':
      return (
        <div className="space-y-1">
          <Label className="text-slate-400">Tag Name</Label>
          <Input
            value={(c.tag_name as string) || ''}
            onChange={(e) => onChange({ ...c, tag_name: e.target.value })}
            placeholder="Tag name..."
            className="border-slate-700 bg-slate-800/50"
          />
        </div>
      )

    case 'update_field':
      return (
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-slate-400">Field</Label>
            <Input
              value={(c.field as string) || ''}
              onChange={(e) => onChange({ ...c, field: e.target.value })}
              placeholder="e.g. custom_fields.score"
              className="border-slate-700 bg-slate-800/50"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-slate-400">Value</Label>
            <Input
              value={String(c.value ?? '')}
              onChange={(e) => onChange({ ...c, value: e.target.value })}
              placeholder="New value..."
              className="border-slate-700 bg-slate-800/50"
            />
          </div>
        </div>
      )

    case 'webhook':
      return (
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-slate-400">Method</Label>
            <Select
              value={(c.method as string) || 'POST'}
              onValueChange={(v) => onChange({ ...c, method: v })}
            >
              <SelectTrigger className="border-slate-700 bg-slate-800/50">
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
            <Label className="text-slate-400">URL</Label>
            <Input
              value={(c.url as string) || ''}
              onChange={(e) => onChange({ ...c, url: e.target.value })}
              placeholder="https://..."
              className="border-slate-700 bg-slate-800/50"
            />
          </div>
        </div>
      )

    case 'notify':
      return (
        <div className="space-y-1">
          <Label className="text-slate-400">Message</Label>
          <Input
            value={(c.message as string) || ''}
            onChange={(e) => onChange({ ...c, message: e.target.value })}
            placeholder="Notification message..."
            className="border-slate-700 bg-slate-800/50"
          />
        </div>
      )

    default:
      return <p className="text-sm text-slate-500">Unknown step type: {step.type}</p>
  }
}

// ─── Step icon/meta helper ──────────────────────────────────────────────────

function getStepMeta(type: string) {
  return STEP_TYPES.find((s) => s.type === type) || {
    type, label: type, icon: Pencil, group: 'Other', color: 'text-slate-400', bg: 'bg-slate-500/10'
  }
}

// ─── Run status badge ──────────────────────────────────────────────────────

function RunStatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'running':
      return <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 px-2.5 py-0.5 text-[11px] font-medium text-blue-400"><Loader2 className="h-3 w-3 animate-spin" />Running</span>
    case 'completed':
      return <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 text-[11px] font-medium text-emerald-400"><CheckCircle2 className="h-3 w-3" />Completed</span>
    case 'failed':
      return <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/10 border border-red-500/20 px-2.5 py-0.5 text-[11px] font-medium text-red-400"><XCircle className="h-3 w-3" />Failed</span>
    case 'waiting':
      return <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 px-2.5 py-0.5 text-[11px] font-medium text-amber-400"><Clock className="h-3 w-3" />Waiting</span>
    case 'cancelled':
      return <span className="inline-flex items-center rounded-full bg-slate-500/10 border border-slate-500/20 px-2.5 py-0.5 text-[11px] font-medium text-slate-400">Cancelled</span>
    default:
      return <span className="inline-flex items-center rounded-full bg-slate-500/10 border border-slate-500/20 px-2.5 py-0.5 text-[11px] font-medium text-slate-400">{status}</span>
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
      <div className="flex flex-col gap-6">
        <Skeleton className="h-9 w-64 bg-slate-800" />
        <Skeleton className="h-[400px] w-full bg-slate-800" />
      </div>
    )
  }

  if (!automation) {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] gap-4">
        <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center">
          <Zap className="h-8 w-8 text-slate-600" />
        </div>
        <h1 className="text-xl font-bold">Automation not found</h1>
        <Link href="/automations">
          <Button variant="outline" className="border-slate-700 text-slate-300">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Automations
          </Button>
        </Link>
      </div>
    )
  }

  const statusConfig = {
    active: { color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', label: 'Active' },
    paused: { color: 'bg-amber-500/10 text-amber-400 border-amber-500/20', label: 'Paused' },
    draft: { color: 'bg-slate-500/10 text-slate-400 border-slate-500/20', label: 'Draft' },
  }
  const currentStatus = statusConfig[automation.status as keyof typeof statusConfig] || statusConfig.draft

  // ─── Render ───────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/automations">
            <button className="w-10 h-10 rounded-lg border border-slate-700 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition-colors">
              <ArrowLeft className="h-4 w-4" />
            </button>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">{automation.name}</h1>
              <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${currentStatus.color}`}>
                {currentStatus.label}
              </span>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className="inline-flex items-center gap-1.5 text-sm text-slate-400">
                <Zap className="h-3.5 w-3.5 text-primary" />
                Trigger: {TRIGGER_LABELS[automation.trigger_type] || automation.trigger_type}
              </span>
              <span className="text-slate-600">·</span>
              <span className="text-sm text-slate-500">
                {automation.steps.length} step{automation.steps.length !== 1 ? 's' : ''}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {automation.status !== 'draft' && (
            <Button
              variant="outline"
              onClick={toggleStatus}
              className="border-slate-700 text-slate-300 hover:bg-slate-800"
            >
              {automation.status === 'active' ? (
                <><Pause className="mr-2 h-4 w-4" /> Pause</>
              ) : (
                <><Play className="mr-2 h-4 w-4" /> Activate</>
              )}
            </Button>
          )}
          {automation.status === 'draft' && automation.steps.length > 0 && (
            <Button
              onClick={toggleStatus}
              className="bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/20"
            >
              <Play className="mr-2 h-4 w-4" />
              Activate
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="builder" onValueChange={(v) => { if (v === 'runs') fetchRuns() }}>
        <TabsList className="bg-slate-800/60 border border-slate-700 p-1">
          <TabsTrigger value="builder" className="data-[state=active]:bg-primary data-[state=active]:text-white">
            Builder
          </TabsTrigger>
          <TabsTrigger value="runs" className="data-[state=active]:bg-primary data-[state=active]:text-white">
            <Users className="mr-1.5 h-3.5 w-3.5" />
            Runs
          </TabsTrigger>
          <TabsTrigger value="settings" className="data-[state=active]:bg-primary data-[state=active]:text-white">
            <Settings className="mr-1.5 h-3.5 w-3.5" />
            Settings
          </TabsTrigger>
        </TabsList>

        {/* ── Builder Tab ────────────────────────────────────────────── */}
        <TabsContent value="builder" className="mt-6">
          <div className="max-w-2xl mx-auto">
            {/* Trigger Card */}
            <div className="relative">
              <div className="bg-card rounded-xl border border-slate-800 p-5 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Zap className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Trigger</p>
                    <p className="text-sm font-semibold text-white">
                      {TRIGGER_LABELS[automation.trigger_type] || automation.trigger_type}
                    </p>
                  </div>
                </div>
              </div>
              {/* Connector line */}
              {automation.steps.length > 0 && (
                <div className="flex justify-center py-1">
                  <div className="w-px h-8 bg-slate-700" />
                </div>
              )}
            </div>

            {/* Steps */}
            {automation.steps.length === 0 ? (
              <div className="mt-4 flex justify-center">
                <Dialog open={showAddStep} onOpenChange={setShowAddStep}>
                  <DialogTrigger asChild>
                    <button className="flex items-center gap-2 px-6 py-3 rounded-xl border-2 border-dashed border-slate-700 text-slate-400 hover:border-primary hover:text-primary transition-colors">
                      <Plus className="h-4 w-4" />
                      Add First Step
                    </button>
                  </DialogTrigger>
                  <AddStepDialogContent onSelect={addStep} />
                </Dialog>
              </div>
            ) : (
              <>
                {automation.steps.map((step, index) => {
                  const meta = getStepMeta(step.type)
                  const Icon = meta.icon
                  const isEditing = editingStep === index

                  return (
                    <div key={index} className="relative">
                      {/* Step Card */}
                      <div
                        className={`bg-card rounded-xl border shadow-sm transition-all ${
                          isEditing
                            ? 'border-primary ring-1 ring-primary/30'
                            : 'border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <div className="p-5">
                          <div className="flex items-start gap-4">
                            {/* Step icon */}
                            <div className={`w-10 h-10 rounded-lg ${meta.bg} flex items-center justify-center shrink-0`}>
                              <Icon className={`h-5 w-5 ${meta.color}`} />
                            </div>

                            {/* Step content */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-[10px] font-bold text-slate-500 bg-slate-800 px-1.5 py-0.5 rounded">
                                  {index + 1}
                                </span>
                                <span className="text-sm font-semibold text-white">{meta.label}</span>
                              </div>

                              {isEditing ? (
                                <div className="mt-3 space-y-4">
                                  <StepEditor
                                    step={step}
                                    onChange={(config) => updateStepConfig(index, config)}
                                  />
                                  <div className="flex gap-2 pt-1">
                                    <Button
                                      size="sm"
                                      onClick={saveCurrentStep}
                                      disabled={isSaving}
                                      className="bg-primary hover:bg-primary/90"
                                    >
                                      <Save className="mr-1.5 h-3.5 w-3.5" />
                                      {isSaving ? 'Saving...' : 'Save'}
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => setEditingStep(null)}
                                      className="text-slate-400"
                                    >
                                      Cancel
                                    </Button>
                                  </div>
                                </div>
                              ) : (
                                <p className="text-sm text-slate-400">
                                  <StepSummary step={step} />
                                </p>
                              )}
                            </div>

                            {/* Actions */}
                            {!isEditing && (
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => moveStep(index, 'up')}
                                  disabled={index === 0}
                                  className="p-1.5 rounded-md text-slate-500 hover:text-white hover:bg-slate-800 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                                >
                                  <ChevronUp className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  onClick={() => moveStep(index, 'down')}
                                  disabled={index === automation.steps.length - 1}
                                  className="p-1.5 rounded-md text-slate-500 hover:text-white hover:bg-slate-800 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                                >
                                  <ChevronDown className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  onClick={() => setEditingStep(index)}
                                  className="p-1.5 rounded-md text-slate-500 hover:text-white hover:bg-slate-800 transition-colors"
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  onClick={() => removeStep(index)}
                                  className="p-1.5 rounded-md text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Condition branching indicator */}
                        {step.type === 'condition' && !isEditing && (
                          <div className="px-5 pb-4 pt-0 flex gap-3">
                            <div className="flex-1 flex items-center gap-2 rounded-lg bg-emerald-500/5 border border-emerald-500/10 px-3 py-2">
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                              <span className="text-xs text-emerald-400 font-medium">YES branch</span>
                            </div>
                            <div className="flex-1 flex items-center gap-2 rounded-lg bg-red-500/5 border border-red-500/10 px-3 py-2">
                              <XCircle className="h-3.5 w-3.5 text-red-400" />
                              <span className="text-xs text-red-400 font-medium">NO branch</span>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Connector line */}
                      {index < automation.steps.length - 1 && (
                        <div className="flex justify-center py-1">
                          <div className="w-px h-8 bg-slate-700" />
                        </div>
                      )}
                    </div>
                  )
                })}

                {/* Add step button */}
                <div className="flex justify-center py-1">
                  <div className="w-px h-6 bg-slate-700" />
                </div>
                <div className="flex justify-center">
                  <Dialog open={showAddStep} onOpenChange={setShowAddStep}>
                    <DialogTrigger asChild>
                      <button className="flex items-center gap-2 px-5 py-2.5 rounded-xl border-2 border-dashed border-slate-700 text-slate-400 hover:border-primary hover:text-primary transition-colors text-sm font-medium">
                        <Plus className="h-4 w-4" />
                        Add Step
                      </button>
                    </DialogTrigger>
                    <AddStepDialogContent onSelect={addStep} />
                  </Dialog>
                </div>
              </>
            )}
          </div>
        </TabsContent>

        {/* ── Runs Tab ───────────────────────────────────────────────── */}
        <TabsContent value="runs" className="mt-6">
          <div className="bg-card rounded-xl border border-slate-800 shadow-sm overflow-hidden">
            {runsLoading ? (
              <div className="p-6 space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full bg-slate-800" />
                ))}
              </div>
            ) : runs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20">
                <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center mb-4">
                  <Users className="h-8 w-8 text-slate-600" />
                </div>
                <p className="text-slate-400">No runs yet</p>
                <p className="text-sm text-slate-500 mt-1">Activate the automation to start enrolling contacts.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-800">
                      <th className="px-6 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Contact</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Step</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Started</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Completed</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50">
                    {runs.map((run) => (
                      <tr key={run.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="px-6 py-3">
                          {run.contacts ? (
                            <Link href={`/contacts/${run.contact_id}`} className="text-sm font-medium text-white hover:text-primary transition-colors">
                              {[run.contacts.first_name, run.contacts.last_name].filter(Boolean).join(' ') || run.contacts.email}
                            </Link>
                          ) : (
                            <span className="text-sm text-slate-500">{run.contact_id.slice(0, 8)}...</span>
                          )}
                        </td>
                        <td className="px-6 py-3">
                          <RunStatusBadge status={run.status} />
                        </td>
                        <td className="px-6 py-3 text-sm text-slate-400">{run.current_step + 1}</td>
                        <td className="px-6 py-3 text-sm text-slate-500">{new Date(run.started_at).toLocaleString()}</td>
                        <td className="px-6 py-3 text-sm text-slate-500">
                          {run.completed_at ? new Date(run.completed_at).toLocaleString() : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </TabsContent>

        {/* ── Settings Tab ───────────────────────────────────────────── */}
        <TabsContent value="settings" className="mt-6 space-y-6 max-w-2xl">
          <div className="bg-card rounded-xl border border-slate-800 shadow-sm p-6">
            <h3 className="text-base font-bold mb-4">General</h3>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="settings-name" className="text-slate-400">Name</Label>
                <Input
                  id="settings-name"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="border-slate-700 bg-slate-800/50"
                />
              </div>
              <div className="flex items-center justify-between rounded-lg border border-slate-700 bg-slate-800/30 p-4">
                <div>
                  <Label className="text-white">Allow Re-entry</Label>
                  <p className="text-sm text-slate-500 mt-0.5">
                    Allow contacts to go through this automation more than once.
                  </p>
                </div>
                <Switch checked={editReEntry} onCheckedChange={setEditReEntry} />
              </div>
              {editReEntry && (
                <div className="space-y-2">
                  <Label className="text-slate-400">Re-entry Delay</Label>
                  <Select value={editReEntryDelay} onValueChange={setEditReEntryDelay}>
                    <SelectTrigger className="border-slate-700 bg-slate-800/50">
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
              <Button
                onClick={saveSettings}
                disabled={isSaving}
                className="bg-primary hover:bg-primary/90"
              >
                <Save className="mr-2 h-4 w-4" />
                {isSaving ? 'Saving...' : 'Save Settings'}
              </Button>
            </div>
          </div>

          {/* Danger Zone */}
          <div className="bg-card rounded-xl border border-red-500/20 shadow-sm p-6">
            <h3 className="text-base font-bold text-red-400 mb-2">Danger Zone</h3>
            <p className="text-sm text-slate-500 mb-4">
              Deleting this automation will cancel all running instances and cannot be undone.
            </p>
            <Dialog open={showDelete} onOpenChange={setShowDelete}>
              <DialogTrigger asChild>
                <Button variant="destructive" className="bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20">
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
                  <Button variant="outline" onClick={() => setShowDelete(false)} className="border-slate-700">
                    Cancel
                  </Button>
                  <Button variant="destructive" onClick={deleteAutomation}>
                    Delete
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
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
      <div className="space-y-5 py-2">
        {groups.map((group) => {
          const items = STEP_TYPES.filter((s) => s.group === group)
          return (
            <div key={group}>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">{group}</p>
              <div className="grid grid-cols-3 gap-2">
                {items.map((item) => {
                  const Icon = item.icon
                  return (
                    <button
                      key={item.type}
                      onClick={() => onSelect(item.type)}
                      className="flex flex-col items-center gap-2 rounded-xl border border-slate-700 bg-slate-800/30 p-4 text-sm hover:border-primary hover:bg-primary/5 transition-all group"
                    >
                      <div className={`w-9 h-9 rounded-lg ${item.bg} flex items-center justify-center`}>
                        <Icon className={`h-4 w-4 ${item.color}`} />
                      </div>
                      <span className="text-xs text-slate-400 group-hover:text-white font-medium text-center">{item.label}</span>
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
