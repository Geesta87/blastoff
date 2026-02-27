'use client'

import { useEffect, useState, useCallback } from 'react'
import { useWorkspace } from '@/lib/hooks/use-workspace'
import { extractMergeTags, htmlToPlainText } from '@/lib/utils/merge-tags'
import type { EmailTemplate } from '@/lib/types'
import { EmailEditor } from '@/components/email/email-editor'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Plus, Pencil, Copy, Trash2, MoreHorizontal } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

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

interface TemplateFormState {
  name: string
  subject: string
  htmlBody: string
  previewText: string
}

const emptyFormState: TemplateFormState = {
  name: '',
  subject: '',
  htmlBody: '',
  previewText: '',
}

export default function EmailTemplatesPage() {
  const { workspace } = useWorkspace()
  const [templates, setTemplates] = useState<EmailTemplate[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  // Sheet state
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null)
  const [formState, setFormState] = useState<TemplateFormState>(emptyFormState)

  // Delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deletingTemplate, setDeletingTemplate] = useState<EmailTemplate | null>(null)

  const fetchTemplates = useCallback(async () => {
    if (!workspace?.id) return
    setIsLoading(true)
    try {
      const res = await fetch('/api/templates/email')
      if (res.ok) {
        const data = await res.json()
        setTemplates(data)
      }
    } catch {
      // Error fetching templates
    } finally {
      setIsLoading(false)
    }
  }, [workspace?.id])

  useEffect(() => {
    fetchTemplates()
  }, [fetchTemplates])

  const handleCreate = () => {
    setEditingTemplate(null)
    setFormState(emptyFormState)
    setSheetOpen(true)
  }

  const handleEdit = (template: EmailTemplate) => {
    setEditingTemplate(template)
    setFormState({
      name: template.name,
      subject: template.subject,
      htmlBody: template.html_body,
      previewText: template.preview_text || '',
    })
    setSheetOpen(true)
  }

  const handleSave = async () => {
    if (!workspace?.id) return
    setIsSaving(true)

    const variables = extractMergeTags(formState.htmlBody + ' ' + formState.subject)
    const textBody = htmlToPlainText(formState.htmlBody)

    const payload = {
      name: formState.name || 'Untitled Template',
      subject: formState.subject,
      html_body: formState.htmlBody,
      text_body: textBody,
      preview_text: formState.previewText || null,
      variables,
    }

    try {
      if (editingTemplate) {
        const res = await fetch(`/api/templates/email/${editingTemplate.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (res.ok) {
          setSheetOpen(false)
          fetchTemplates()
        }
      } else {
        const res = await fetch('/api/templates/email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (res.ok) {
          setSheetOpen(false)
          fetchTemplates()
        }
      }
    } catch {
      // Error saving template
    } finally {
      setIsSaving(false)
    }
  }

  const handleDuplicate = async (template: EmailTemplate) => {
    try {
      const res = await fetch('/api/templates/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `${template.name} (Copy)`,
          subject: template.subject,
          html_body: template.html_body,
          text_body: template.text_body,
          preview_text: template.preview_text,
          variables: template.variables,
        }),
      })
      if (res.ok) {
        fetchTemplates()
      }
    } catch {
      // Error duplicating template
    }
  }

  const handleDeleteConfirm = async () => {
    if (!deletingTemplate) return
    try {
      const res = await fetch(`/api/templates/email/${deletingTemplate.id}`, {
        method: 'DELETE',
      })
      if (res.ok) {
        setDeleteDialogOpen(false)
        setDeletingTemplate(null)
        fetchTemplates()
      }
    } catch {
      // Error deleting template
    }
  }

  const openDeleteDialog = (template: EmailTemplate) => {
    setDeletingTemplate(template)
    setDeleteDialogOpen(true)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Email Templates</h1>
        <Button onClick={handleCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Create Template
        </Button>
      </div>

      {/* Template List */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 p-4 border rounded-lg">
              <Skeleton className="h-5 w-[200px]" />
              <Skeleton className="h-5 w-[300px]" />
              <Skeleton className="h-5 w-[100px] ml-auto" />
            </div>
          ))}
        </div>
      ) : templates.length === 0 ? (
        <div className="rounded-lg border p-8 text-center text-muted-foreground">
          No email templates yet. Create your first template to get started.
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead>Last Updated</TableHead>
                <TableHead className="w-[70px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {templates.map((template) => (
                <TableRow key={template.id}>
                  <TableCell className="font-medium">
                    {template.name}
                    {template.variables.length > 0 && (
                      <Badge variant="secondary" className="ml-2 text-xs">
                        {template.variables.length} merge {template.variables.length === 1 ? 'tag' : 'tags'}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground max-w-[300px] truncate">
                    {template.subject || '(no subject)'}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {relativeTime(template.updated_at)}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEdit(template)}>
                          <Pencil className="mr-2 h-4 w-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleDuplicate(template)}>
                          <Copy className="mr-2 h-4 w-4" />
                          Duplicate
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => openDeleteDialog(template)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Create/Edit Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-[90vw] lg:max-w-[1200px] overflow-y-auto"
        >
          <SheetHeader>
            <SheetTitle>
              {editingTemplate ? 'Edit Template' : 'Create Template'}
            </SheetTitle>
          </SheetHeader>
          <div className="mt-6 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="template-name">Template Name</Label>
              <Input
                id="template-name"
                placeholder="e.g. Welcome Email"
                value={formState.name}
                onChange={(e) =>
                  setFormState((prev) => ({ ...prev, name: e.target.value }))
                }
              />
            </div>
            <EmailEditor
              subject={formState.subject}
              onSubjectChange={(subject) =>
                setFormState((prev) => ({ ...prev, subject }))
              }
              previewText={formState.previewText}
              onPreviewTextChange={(previewText) =>
                setFormState((prev) => ({ ...prev, previewText }))
              }
              htmlBody={formState.htmlBody}
              onHtmlBodyChange={(htmlBody) =>
                setFormState((prev) => ({ ...prev, htmlBody }))
              }
            />
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setSheetOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving ? 'Saving...' : editingTemplate ? 'Update Template' : 'Create Template'}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Template</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete &quot;{deletingTemplate?.name}&quot;? This action
            cannot be undone.
          </p>
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
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
