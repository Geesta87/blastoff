'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useWorkspace } from '@/lib/hooks/use-workspace'
import { useSMSCounter } from '@/lib/hooks/use-sms-counter'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { Plus, MessageSquare, Pencil, Trash2, Save, Loader2 } from 'lucide-react'

interface SmsTemplate {
  id: string
  workspace_id: string
  name: string
  body: string
  variables: string[]
  is_archived: boolean
  created_at: string
  updated_at: string
}

const MERGE_TAGS = [
  { label: 'First Name', tag: '{{first_name}}' },
  { label: 'Last Name', tag: '{{last_name}}' },
  { label: 'Full Name', tag: '{{full_name}}' },
  { label: 'Company', tag: '{{company}}' },
] as const

function relativeTime(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHr = Math.floor(diffMin / 60)
  const diffDays = Math.floor(diffHr / 24)

  if (diffSec < 60) return 'just now'
  if (diffMin < 60) return `${diffMin}m ago`
  if (diffHr < 24) return `${diffHr}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`
  return date.toLocaleDateString()
}

function truncateBody(body: string, maxLen = 80): string {
  if (body.length <= maxLen) return body
  return body.slice(0, maxLen).trimEnd() + '...'
}

function extractVariables(text: string): string[] {
  const matches = text.match(/\{\{(\w+)\}\}/g)
  if (!matches) return []
  const unique = new Set(matches.map((m) => m.replace(/\{\{|\}\}/g, '')))
  return Array.from(unique)
}

// ---------- SMS Counter display ----------

function SMSCounterBar({ text }: { text: string }) {
  const counter = useSMSCounter(text)

  const barColor =
    counter.warningLevel === 'red'
      ? 'text-red-500'
      : counter.warningLevel === 'yellow'
        ? 'text-yellow-600'
        : 'text-muted-foreground'

  return (
    <div className={`flex flex-wrap items-center gap-x-3 gap-y-1 text-xs ${barColor}`}>
      <span>{counter.charCount} chars</span>
      <span className="text-muted-foreground/40">|</span>
      <span>
        {counter.segmentCount} segment{counter.segmentCount !== 1 ? 's' : ''}
      </span>
      <span className="text-muted-foreground/40">|</span>
      <span>{counter.encoding}</span>
      <span className="text-muted-foreground/40">|</span>
      <span>~${counter.costEstimate.toFixed(4)}/msg</span>
      {counter.warningLevel === 'red' && (
        <span className="ml-1 font-medium">
          URLs increase segment count significantly
        </span>
      )}
    </div>
  )
}

// ---------- Edit form used in dialog ----------

interface TemplateFormProps {
  name: string
  body: string
  onNameChange: (v: string) => void
  onBodyChange: (v: string) => void
}

function TemplateForm({ name, body, onNameChange, onBodyChange }: TemplateFormProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const insertMergeTag = (tag: string) => {
    const el = textareaRef.current
    if (!el) {
      onBodyChange(body + tag)
      return
    }
    const start = el.selectionStart
    const end = el.selectionEnd
    const newBody = body.slice(0, start) + tag + body.slice(end)
    onBodyChange(newBody)
    // Restore cursor position after React re-render
    requestAnimationFrame(() => {
      el.focus()
      const pos = start + tag.length
      el.setSelectionRange(pos, pos)
    })
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="sms-template-name">Template Name</Label>
        <Input
          id="sms-template-name"
          placeholder="e.g. Welcome SMS"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="sms-template-body">Message Body</Label>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {MERGE_TAGS.map((mt) => (
            <Button
              key={mt.tag}
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={() => insertMergeTag(mt.tag)}
            >
              {mt.label}
            </Button>
          ))}
        </div>
        <Textarea
          ref={textareaRef}
          id="sms-template-body"
          placeholder="Hi {{first_name}}, thanks for signing up!"
          value={body}
          onChange={(e) => onBodyChange(e.target.value)}
          rows={6}
          className="resize-y font-mono text-sm"
        />
        <SMSCounterBar text={body} />
      </div>
    </div>
  )
}

// ---------- Main page ----------

export default function SmsTemplatesPage() {
  const { workspace } = useWorkspace()
  const [templates, setTemplates] = useState<SmsTemplate[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<SmsTemplate | null>(null)
  const [formName, setFormName] = useState('')
  const [formBody, setFormBody] = useState('')

  // Delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deletingTemplate, setDeletingTemplate] = useState<SmsTemplate | null>(null)

  // ---------- Fetch ----------

  const fetchTemplates = useCallback(async () => {
    if (!workspace?.id) return
    setIsLoading(true)
    try {
      const res = await fetch('/api/templates/sms')
      if (res.ok) {
        const data = await res.json()
        setTemplates(data)
      }
    } catch {
      // network error
    } finally {
      setIsLoading(false)
    }
  }, [workspace?.id])

  useEffect(() => {
    fetchTemplates()
  }, [fetchTemplates])

  // ---------- Create / Edit ----------

  const handleCreate = () => {
    setEditingTemplate(null)
    setFormName('')
    setFormBody('')
    setDialogOpen(true)
  }

  const handleEdit = (template: SmsTemplate) => {
    setEditingTemplate(template)
    setFormName(template.name)
    setFormBody(template.body)
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (!workspace?.id) return
    setIsSaving(true)

    const variables = extractVariables(formBody)
    const payload = {
      name: formName || 'Untitled SMS Template',
      body: formBody,
      variables,
    }

    try {
      if (editingTemplate) {
        const res = await fetch(`/api/templates/sms/${editingTemplate.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (res.ok) {
          setDialogOpen(false)
          fetchTemplates()
        }
      } else {
        const res = await fetch('/api/templates/sms', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (res.ok) {
          setDialogOpen(false)
          fetchTemplates()
        }
      }
    } catch {
      // save error
    } finally {
      setIsSaving(false)
    }
  }

  // ---------- Delete ----------

  const openDeleteDialog = (template: SmsTemplate) => {
    setDeletingTemplate(template)
    setDeleteDialogOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (!deletingTemplate) return
    try {
      const res = await fetch(`/api/templates/sms/${deletingTemplate.id}`, {
        method: 'DELETE',
      })
      if (res.ok) {
        setDeleteDialogOpen(false)
        setDeletingTemplate(null)
        fetchTemplates()
      }
    } catch {
      // delete error
    }
  }

  // ---------- Render ----------

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">SMS Templates</h1>
          <p className="text-muted-foreground mt-1">
            Manage reusable SMS templates for your campaigns.
          </p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="mr-2 h-4 w-4" />
          New Template
        </Button>
      </div>

      {/* Template list */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-3">
                <Skeleton className="h-5 w-[160px]" />
              </CardHeader>
              <CardContent className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-[100px]" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : templates.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <MessageSquare className="h-12 w-12 text-muted-foreground/40 mb-4" />
            <h3 className="text-lg font-medium mb-1">No SMS templates yet</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Create your first SMS template to start sending messages.
            </p>
            <Button onClick={handleCreate}>
              <Plus className="mr-2 h-4 w-4" />
              New Template
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((template) => (
            <TemplateCard
              key={template.id}
              template={template}
              onEdit={handleEdit}
              onDelete={openDeleteDialog}
            />
          ))}
        </div>
      )}

      {/* Create / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[540px]">
          <DialogHeader>
            <DialogTitle>
              {editingTemplate ? 'Edit SMS Template' : 'Create SMS Template'}
            </DialogTitle>
            <DialogDescription>
              {editingTemplate
                ? 'Update your SMS template content and settings.'
                : 'Write a new SMS template. Use merge tags to personalize messages.'}
            </DialogDescription>
          </DialogHeader>

          <TemplateForm
            name={formName}
            body={formBody}
            onNameChange={setFormName}
            onBodyChange={setFormBody}
          />

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  {editingTemplate ? 'Update Template' : 'Create Template'}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Template</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{deletingTemplate?.name}&quot;? This
              action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDeleteDialogOpen(false)
                setDeletingTemplate(null)
              }}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteConfirm}>
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ---------- Template card ----------

interface TemplateCardProps {
  template: SmsTemplate
  onEdit: (t: SmsTemplate) => void
  onDelete: (t: SmsTemplate) => void
}

function TemplateCard({ template, onEdit, onDelete }: TemplateCardProps) {
  const counter = useSMSCounter(template.body)

  return (
    <Card className="group relative flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base leading-snug">{template.name}</CardTitle>
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => onEdit(template)}
            >
              <Pencil className="h-3.5 w-3.5" />
              <span className="sr-only">Edit</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 text-destructive hover:text-destructive"
              onClick={() => onDelete(template)}
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span className="sr-only">Delete</span>
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 space-y-3">
        {/* Body preview */}
        <p className="text-sm text-muted-foreground font-mono leading-relaxed">
          {truncateBody(template.body)}
        </p>

        {/* Variables */}
        {template.variables.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {template.variables.map((v) => (
              <Badge key={v} variant="secondary" className="text-xs">
                {`{{${v}}}`}
              </Badge>
            ))}
          </div>
        )}

        {/* Meta line */}
        <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 border-t">
          <span>
            {counter.segmentCount} segment{counter.segmentCount !== 1 ? 's' : ''}{' '}
            <span className="text-muted-foreground/50 mx-1">-</span>
            {counter.encoding}
          </span>
          <span>{relativeTime(template.updated_at)}</span>
        </div>
      </CardContent>
    </Card>
  )
}
