'use client'

import { use, useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  MoreHorizontal,
  Pencil,
  Save,
  Trash2,
  X,
  Plus,
  Mail,
  MailOpen,
  MailX,
  MessageSquare,
  UserPlus,
  UserMinus,
  Upload,
  MousePointerClick,
  CheckCheck,
  CheckCircle,
  Tag as TagIcon,
  Zap,
  Activity,
  Send,
  Bot,
} from 'lucide-react'

import { useWorkspace } from '@/lib/hooks/use-workspace'
import { createClient } from '@/lib/supabase/client'
import { formatPhone, formatRelativeTime, statusVariant } from '@/lib/utils/format'
import type { Contact, Tag, ContactActivity } from '@/lib/types'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'

// ---------------------------------------------------------------------------
// Activity icon mapping
// ---------------------------------------------------------------------------
function activityIcon(type: string) {
  switch (type) {
    case 'contact_created':
      return <UserPlus className="h-4 w-4" />
    case 'contact_imported':
      return <Upload className="h-4 w-4" />
    case 'email_sent':
      return <Mail className="h-4 w-4" />
    case 'email_opened':
      return <MailOpen className="h-4 w-4" />
    case 'email_clicked':
      return <MousePointerClick className="h-4 w-4" />
    case 'email_bounced':
      return <MailX className="h-4 w-4" />
    case 'sms_sent':
      return <MessageSquare className="h-4 w-4" />
    case 'sms_delivered':
      return <CheckCheck className="h-4 w-4" />
    case 'tag_added':
      return <TagIcon className="h-4 w-4" />
    case 'tag_removed':
      return <TagIcon className="h-4 w-4" />
    case 'unsubscribed':
      return <UserMinus className="h-4 w-4" />
    case 'automation_entered':
      return <Zap className="h-4 w-4" />
    case 'automation_completed':
      return <CheckCircle className="h-4 w-4" />
    case 'contact_updated':
      return <Pencil className="h-4 w-4" />
    default:
      return <Activity className="h-4 w-4" />
  }
}

function formatActivityType(type: string): string {
  return type
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------
const ACTIVITIES_PER_PAGE = 20

export default function ContactDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const resolvedParams = use(params)
  const contactId = resolvedParams.id

  const router = useRouter()
  useWorkspace()

  // State
  const [contact, setContact] = useState<Contact | null>(null)
  const [tags, setTags] = useState<Tag[]>([])
  const [activities, setActivities] = useState<ContactActivity[]>([])
  const [activitiesPage, setActivitiesPage] = useState(1)
  const [hasMoreActivities, setHasMoreActivities] = useState(true)
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [tagPopoverOpen, setTagPopoverOpen] = useState(false)

  // Edit form state
  const [editForm, setEditForm] = useState<{
    first_name: string
    last_name: string
    email: string
    phone: string
    source: string
    lead_score: number
    custom_fields: Record<string, unknown>
  }>({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    source: '',
    lead_score: 0,
    custom_fields: {},
  })

  // New custom field form
  const [newFieldKey, setNewFieldKey] = useState('')
  const [newFieldValue, setNewFieldValue] = useState('')

  // Automation enrollment
  const [availableAutomations, setAvailableAutomations] = useState<{ id: string; name: string }[]>([])
  const [automationPopoverOpen, setAutomationPopoverOpen] = useState(false)
  const [enrolling, setEnrolling] = useState(false)

  // -------------------------------------------------------------------
  // Fetch contact
  // -------------------------------------------------------------------
  const fetchContact = useCallback(async () => {
    try {
      const res = await fetch(`/api/contacts/${contactId}`)
      if (!res.ok) throw new Error('Failed to fetch contact')
      const data: Contact = await res.json()
      setContact(data)
      setEditForm({
        first_name: data.first_name || '',
        last_name: data.last_name || '',
        email: data.email || '',
        phone: data.phone || '',
        source: data.source || '',
        lead_score: data.lead_score ?? 0,
        custom_fields: (data.custom_fields as Record<string, unknown>) || {},
      })
    } catch {
      // Contact not found or error - leave as null
    }
  }, [contactId])

  // -------------------------------------------------------------------
  // Fetch all workspace tags
  // -------------------------------------------------------------------
  const fetchTags = useCallback(async () => {
    try {
      const res = await fetch('/api/tags')
      if (!res.ok) return
      const data: Tag[] = await res.json()
      setTags(data)
    } catch {
      // ignore
    }
  }, [])

  // -------------------------------------------------------------------
  // Fetch activities via supabase client
  // -------------------------------------------------------------------
  const fetchActivities = useCallback(
    async (page: number, append = false) => {
      const supabase = createClient()
      const from = (page - 1) * ACTIVITIES_PER_PAGE
      const to = from + ACTIVITIES_PER_PAGE - 1

      const { data, error } = await supabase
        .from('contact_activities')
        .select('*')
        .eq('contact_id', contactId)
        .order('created_at', { ascending: false })
        .range(from, to)

      if (!error && data) {
        if (append) {
          setActivities((prev) => [...prev, ...(data as ContactActivity[])])
        } else {
          setActivities(data as ContactActivity[])
        }
        setHasMoreActivities(data.length === ACTIVITIES_PER_PAGE)
      }
    },
    [contactId]
  )

  // -------------------------------------------------------------------
  // Initial load
  // -------------------------------------------------------------------
  useEffect(() => {
    async function load() {
      setIsLoading(true)
      await Promise.all([fetchContact(), fetchTags(), fetchActivities(1)])
      setIsLoading(false)
    }
    load()
  }, [fetchContact, fetchTags, fetchActivities])

  // -------------------------------------------------------------------
  // Save contact
  // -------------------------------------------------------------------
  async function handleSave() {
    if (!contact) return
    setIsSaving(true)

    try {
      const res = await fetch(`/api/contacts/${contactId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          first_name: editForm.first_name || null,
          last_name: editForm.last_name || null,
          email: editForm.email || null,
          phone: editForm.phone || null,
          lead_score: editForm.lead_score,
          custom_fields: editForm.custom_fields,
        }),
      })

      if (res.ok) {
        await fetchContact()
        setIsEditing(false)
      }
    } finally {
      setIsSaving(false)
    }
  }

  // -------------------------------------------------------------------
  // Delete contact
  // -------------------------------------------------------------------
  async function handleDelete() {
    const res = await fetch(`/api/contacts/${contactId}`, { method: 'DELETE' })
    if (res.ok) {
      router.push('/contacts')
    }
  }

  // -------------------------------------------------------------------
  // Tag management
  // -------------------------------------------------------------------
  async function handleAddTag(tagId: string) {
    await fetch(`/api/contacts/${contactId}/tags`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tag_id: tagId }),
    })
    setTagPopoverOpen(false)
    await fetchContact()
    await fetchActivities(1)
  }

  async function handleRemoveTag(tagId: string) {
    await fetch(`/api/contacts/${contactId}/tags?tag_id=${tagId}`, {
      method: 'DELETE',
    })
    await fetchContact()
    await fetchActivities(1)
  }

  // -------------------------------------------------------------------
  // Automation enrollment
  // -------------------------------------------------------------------
  async function fetchAutomations() {
    try {
      const res = await fetch('/api/automations?status=active&limit=50')
      if (res.ok) {
        const data = await res.json()
        setAvailableAutomations(
          (data.automations || []).map((a: { id: string; name: string }) => ({
            id: a.id,
            name: a.name,
          }))
        )
      }
    } catch (err) {
      console.error('Failed to fetch automations:', err)
    }
  }

  async function handleEnrollAutomation(automationId: string) {
    setEnrolling(true)
    try {
      const res = await fetch(`/api/automations/${automationId}/runs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contact_id: contactId }),
      })
      if (res.ok) {
        setAutomationPopoverOpen(false)
        await fetchActivities(1)
      }
    } catch (err) {
      console.error('Failed to enroll in automation:', err)
    } finally {
      setEnrolling(false)
    }
  }

  // -------------------------------------------------------------------
  // Notes auto-save on blur
  // -------------------------------------------------------------------
  async function handleNotesSave(notes: string) {
    if (!contact) return
    const currentCustomFields =
      (contact.custom_fields as Record<string, unknown>) || {}
    await fetch(`/api/contacts/${contactId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        custom_fields: { ...currentCustomFields, notes },
      }),
    })
    await fetchContact()
  }

  // -------------------------------------------------------------------
  // Load more activities
  // -------------------------------------------------------------------
  function handleLoadMoreActivities() {
    const nextPage = activitiesPage + 1
    setActivitiesPage(nextPage)
    fetchActivities(nextPage, true)
  }

  // -------------------------------------------------------------------
  // Custom fields helpers
  // -------------------------------------------------------------------
  function handleAddCustomField() {
    if (!newFieldKey.trim()) return
    setEditForm((prev) => ({
      ...prev,
      custom_fields: {
        ...prev.custom_fields,
        [newFieldKey.trim()]: newFieldValue,
      },
    }))
    setNewFieldKey('')
    setNewFieldValue('')
  }

  function handleRemoveCustomField(key: string) {
    setEditForm((prev) => {
      const updated = { ...prev.custom_fields }
      delete updated[key]
      return { ...prev, custom_fields: updated }
    })
  }

  // -------------------------------------------------------------------
  // Loading state
  // -------------------------------------------------------------------
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-8 w-8" />
          <Skeleton className="h-8 w-64" />
        </div>
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
          <div className="space-y-6">
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        </div>
      </div>
    )
  }

  if (!contact) {
    return (
      <div className="space-y-6">
        <Link href="/contacts" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
          Back to Contacts
        </Link>
        <div className="rounded-lg border p-8 text-center text-muted-foreground">
          Contact not found.
        </div>
      </div>
    )
  }

  // Derived values
  const fullName = [contact.first_name, contact.last_name].filter(Boolean).join(' ') || 'Unnamed Contact'
  const contactTags = contact.tags || []
  const contactTagIds = new Set(contactTags.map((t) => t.id))
  const availableTags = tags.filter((t) => !contactTagIds.has(t.id))
  const customFieldEntries = Object.entries(
    (contact.custom_fields as Record<string, unknown>) || {}
  ).filter(([key]) => key !== 'notes')
  const notesValue = ((contact.custom_fields as Record<string, unknown>)?.notes as string) || ''

  const editCustomFieldEntries = Object.entries(editForm.custom_fields).filter(
    ([key]) => key !== 'notes'
  )

  return (
    <div className="space-y-6">
      {/* ================================================================== */}
      {/* Header                                                             */}
      {/* ================================================================== */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-4">
          <Link
            href="/contacts"
            className="mt-1 inline-flex items-center justify-center rounded-md border p-2 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold">{fullName}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
              {contact.email && <span>{contact.email}</span>}
              {contact.phone && <span>{formatPhone(contact.phone)}</span>}
              <Badge variant={statusVariant(contact.status)}>
                {contact.status}
              </Badge>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isEditing ? (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setIsEditing(false)
                  // Reset form
                  setEditForm({
                    first_name: contact.first_name || '',
                    last_name: contact.last_name || '',
                    email: contact.email || '',
                    phone: contact.phone || '',
                    source: contact.source || '',
                    lead_score: contact.lead_score ?? 0,
                    custom_fields:
                      (contact.custom_fields as Record<string, unknown>) || {},
                  })
                }}
              >
                <X className="mr-1 h-4 w-4" />
                Cancel
              </Button>
              <Button size="sm" onClick={handleSave} disabled={isSaving}>
                <Save className="mr-1 h-4 w-4" />
                {isSaving ? 'Saving...' : 'Save'}
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsEditing(true)}
              >
                <Pencil className="mr-1 h-4 w-4" />
                Edit
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={() => setDeleteDialogOpen(true)}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete Contact
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}
        </div>
      </div>

      {/* ================================================================== */}
      {/* Two-column layout                                                  */}
      {/* ================================================================== */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* ---------------------------------------------------------------- */}
        {/* Left Column                                                      */}
        {/* ---------------------------------------------------------------- */}
        <div className="space-y-6 lg:col-span-2">
          {/* Info Card */}
          <Card>
            <CardHeader>
              <CardTitle>Contact Information</CardTitle>
            </CardHeader>
            <CardContent>
              {isEditing ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="first_name">First Name</Label>
                    <Input
                      id="first_name"
                      value={editForm.first_name}
                      onChange={(e) =>
                        setEditForm((f) => ({
                          ...f,
                          first_name: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="last_name">Last Name</Label>
                    <Input
                      id="last_name"
                      value={editForm.last_name}
                      onChange={(e) =>
                        setEditForm((f) => ({
                          ...f,
                          last_name: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        id="email"
                        type="email"
                        value={editForm.email}
                        onChange={(e) =>
                          setEditForm((f) => ({
                            ...f,
                            email: e.target.value,
                          }))
                        }
                      />
                      <Badge variant={statusVariant(contact.email_status)} className="shrink-0">
                        {contact.email_status}
                      </Badge>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        id="phone"
                        value={editForm.phone}
                        onChange={(e) =>
                          setEditForm((f) => ({
                            ...f,
                            phone: e.target.value,
                          }))
                        }
                      />
                      <Badge variant={statusVariant(contact.sms_status)} className="shrink-0">
                        {contact.sms_status}
                      </Badge>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="source">Source</Label>
                    <Input
                      id="source"
                      value={editForm.source}
                      disabled
                      className="bg-muted"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lead_score">Lead Score</Label>
                    <Input
                      id="lead_score"
                      type="number"
                      value={editForm.lead_score}
                      onChange={(e) =>
                        setEditForm((f) => ({
                          ...f,
                          lead_score: parseInt(e.target.value, 10) || 0,
                        }))
                      }
                    />
                  </div>
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <p className="text-sm text-muted-foreground">First Name</p>
                    <p className="font-medium">
                      {contact.first_name || <span className="text-muted-foreground">--</span>}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Last Name</p>
                    <p className="font-medium">
                      {contact.last_name || <span className="text-muted-foreground">--</span>}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Email</p>
                    <div className="flex items-center gap-2">
                      <p className="font-medium">
                        {contact.email || <span className="text-muted-foreground">--</span>}
                      </p>
                      {contact.email && (
                        <Badge variant={statusVariant(contact.email_status)} className="text-[10px]">
                          {contact.email_status}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Phone</p>
                    <div className="flex items-center gap-2">
                      <p className="font-medium">
                        {contact.phone ? (
                          formatPhone(contact.phone)
                        ) : (
                          <span className="text-muted-foreground">--</span>
                        )}
                      </p>
                      {contact.phone && (
                        <Badge variant={statusVariant(contact.sms_status)} className="text-[10px]">
                          {contact.sms_status}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Source</p>
                    <p className="font-medium">{contact.source || '--'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Lead Score</p>
                    <p className="font-medium">{contact.lead_score}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Tags Section */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Tags</CardTitle>
                <Popover open={tagPopoverOpen} onOpenChange={setTagPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Plus className="mr-1 h-4 w-4" />
                      Add Tag
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-64 p-0" align="end">
                    <Command>
                      <CommandInput placeholder="Search tags..." />
                      <CommandList>
                        <CommandEmpty>No tags found.</CommandEmpty>
                        <CommandGroup>
                          {availableTags.map((tag) => (
                            <CommandItem
                              key={tag.id}
                              onSelect={() => handleAddTag(tag.id)}
                              className="cursor-pointer"
                            >
                              <span
                                className="mr-2 inline-block h-3 w-3 rounded-full"
                                style={{ backgroundColor: tag.color }}
                              />
                              {tag.name}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
            </CardHeader>
            <CardContent>
              {contactTags.length === 0 ? (
                <p className="text-sm text-muted-foreground">No tags assigned.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {contactTags.map((tag) => (
                    <Badge
                      key={tag.id}
                      variant="secondary"
                      className="gap-1 pr-1"
                      style={{
                        backgroundColor: tag.color + '20',
                        borderColor: tag.color,
                        color: tag.color,
                      }}
                    >
                      {tag.name}
                      <button
                        onClick={() => handleRemoveTag(tag.id)}
                        className="ml-1 rounded-full p-0.5 hover:bg-black/10"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Custom Fields Section */}
          <Card>
            <CardHeader>
              <CardTitle>Custom Fields</CardTitle>
            </CardHeader>
            <CardContent>
              {isEditing ? (
                <div className="space-y-4">
                  {editCustomFieldEntries.map(([key, value]) => (
                    <div key={key} className="flex items-center gap-2">
                      <div className="flex-1">
                        <Label className="text-xs text-muted-foreground">{key}</Label>
                        <Input
                          value={String(value ?? '')}
                          onChange={(e) =>
                            setEditForm((prev) => ({
                              ...prev,
                              custom_fields: {
                                ...prev.custom_fields,
                                [key]: e.target.value,
                              },
                            }))
                          }
                        />
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="mt-5 shrink-0"
                        onClick={() => handleRemoveCustomField(key)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  <Separator />
                  <div className="flex items-end gap-2">
                    <div className="flex-1 space-y-1">
                      <Label className="text-xs">Field Name</Label>
                      <Input
                        placeholder="e.g. company"
                        value={newFieldKey}
                        onChange={(e) => setNewFieldKey(e.target.value)}
                      />
                    </div>
                    <div className="flex-1 space-y-1">
                      <Label className="text-xs">Value</Label>
                      <Input
                        placeholder="e.g. Acme Inc"
                        value={newFieldValue}
                        onChange={(e) => setNewFieldValue(e.target.value)}
                      />
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleAddCustomField}
                      disabled={!newFieldKey.trim()}
                    >
                      <Plus className="mr-1 h-4 w-4" />
                      Add
                    </Button>
                  </div>
                </div>
              ) : customFieldEntries.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No custom fields set.
                </p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {customFieldEntries.map(([key, value]) => (
                    <div key={key}>
                      <p className="text-sm text-muted-foreground">{key}</p>
                      <p className="font-medium">{String(value ?? '--')}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Notes Section */}
          <Card>
            <CardHeader>
              <CardTitle>Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                placeholder="Add notes about this contact..."
                defaultValue={notesValue}
                rows={5}
                onBlur={(e) => {
                  if (e.target.value !== notesValue) {
                    handleNotesSave(e.target.value)
                  }
                }}
              />
              <p className="mt-2 text-xs text-muted-foreground">
                Notes auto-save when you click outside.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* Right Column                                                     */}
        {/* ---------------------------------------------------------------- */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button variant="outline" className="w-full justify-start" disabled>
                <Send className="mr-2 h-4 w-4" />
                Send Email
              </Button>
              <Button variant="outline" className="w-full justify-start" disabled>
                <MessageSquare className="mr-2 h-4 w-4" />
                Send SMS
              </Button>
              <Popover
                open={automationPopoverOpen}
                onOpenChange={(open) => {
                  setAutomationPopoverOpen(open)
                  if (open) fetchAutomations()
                }}
              >
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start" disabled={enrolling}>
                    <Bot className="mr-2 h-4 w-4" />
                    {enrolling ? 'Enrolling...' : 'Add to Automation'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-64 p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Search automations..." />
                    <CommandList>
                      <CommandEmpty>No active automations found.</CommandEmpty>
                      <CommandGroup>
                        {availableAutomations.map((a) => (
                          <CommandItem key={a.id} onSelect={() => handleEnrollAutomation(a.id)}>
                            <Zap className="mr-2 h-4 w-4" />
                            {a.name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </CardContent>
          </Card>

          {/* Activity Timeline */}
          <Card>
            <CardHeader>
              <CardTitle>Activity</CardTitle>
            </CardHeader>
            <CardContent>
              {activities.length === 0 ? (
                <p className="text-sm text-muted-foreground">No activity yet.</p>
              ) : (
                <div className="relative space-y-0">
                  {activities.map((activity, index) => {
                    const isLast = index === activities.length - 1
                    const metadata = activity.metadata as Record<string, unknown> | null

                    let metadataDetail = ''
                    if (metadata) {
                      if (metadata.tag_name) {
                        metadataDetail = String(metadata.tag_name)
                      } else if (metadata.email_subject) {
                        metadataDetail = String(metadata.email_subject)
                      } else if (metadata.tag_id) {
                        metadataDetail = `Tag: ${String(metadata.tag_id).slice(0, 8)}...`
                      } else if (metadata.updated_fields) {
                        const fields = metadata.updated_fields as string[]
                        metadataDetail = `Updated: ${fields.join(', ')}`
                      }
                    }

                    return (
                      <div key={activity.id} className="relative flex gap-3 pb-6">
                        {/* Vertical line */}
                        {!isLast && (
                          <div className="absolute left-[11px] top-6 h-full w-px bg-border" />
                        )}
                        {/* Dot / Icon */}
                        <div className="relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border bg-background text-muted-foreground">
                          {activityIcon(activity.activity_type)}
                        </div>
                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium leading-tight">
                            {formatActivityType(activity.activity_type)}
                          </p>
                          {metadataDetail && (
                            <p className="mt-0.5 text-xs text-muted-foreground truncate">
                              {metadataDetail}
                            </p>
                          )}
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {formatRelativeTime(activity.created_at)}
                          </p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {hasMoreActivities && activities.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-2 w-full"
                  onClick={handleLoadMoreActivities}
                >
                  Load more
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ================================================================== */}
      {/* Delete Confirmation Dialog                                         */}
      {/* ================================================================== */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Contact</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {fullName}? This action cannot be
              undone. All activities and tag associations will be permanently
              removed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              <Trash2 className="mr-1 h-4 w-4" />
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
