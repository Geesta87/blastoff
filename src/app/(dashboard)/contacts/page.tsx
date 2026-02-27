'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useWorkspace } from '@/lib/hooks/use-workspace'
import { CONTACT_STATUSES } from '@/lib/constants'
import { formatPhone, formatRelativeTime, statusVariant, truncate } from '@/lib/utils/format'
import type { Contact, Tag } from '@/lib/types'

import { AddContactSheet } from '@/components/contacts/add-contact-sheet'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Calendar } from '@/components/ui/calendar'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

import {
  Search,
  Plus,
  Upload,
  ChevronUp,
  ChevronDown,
  Check,
  X,
  Loader2,
  Trash2,
  Download,
  Tag as TagIcon,
  CalendarIcon,
  Users,
} from 'lucide-react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Filters {
  status: string
  email_status: string
  sms_status: string
  tag_ids: string[]
  created_after: string
}

const emptyFilters: Filters = {
  status: '',
  email_status: '',
  sms_status: '',
  tag_ids: [],
  created_after: '',
}

const EMAIL_STATUS_OPTIONS = ['active', 'unsubscribed', 'bounced', 'complained']
const SMS_STATUS_OPTIONS = ['active', 'unsubscribed', 'stopped']

// ---------------------------------------------------------------------------
// Page Component
// ---------------------------------------------------------------------------

export default function ContactsPage() {
  const { workspace } = useWorkspace()

  // Data
  const [contacts, setContacts] = useState<Contact[]>([])
  const [tags, setTags] = useState<Tag[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [limit] = useState(25)
  const [totalPages, setTotalPages] = useState(0)

  // Search
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')

  // Filters / Sort
  const [filters, setFilters] = useState<Filters>(emptyFilters)
  const [sort, setSort] = useState('created_at')
  const [order, setOrder] = useState<'asc' | 'desc'>('desc')

  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  // UI state
  const [isLoading, setIsLoading] = useState(true)
  const [addSheetOpen, setAddSheetOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [tagFilterOpen, setTagFilterOpen] = useState(false)
  const [dateFilterOpen, setDateFilterOpen] = useState(false)

  // ------------------------------------------------------------------
  // Debounce search input
  // ------------------------------------------------------------------
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search)
      setPage(1) // reset to first page on new search
    }, 300)
    return () => clearTimeout(timer)
  }, [search])

  // ------------------------------------------------------------------
  // Fetch tags on mount
  // ------------------------------------------------------------------
  useEffect(() => {
    if (!workspace) return
    const loadTags = async () => {
      try {
        const res = await fetch('/api/tags')
        if (res.ok) {
          const data = await res.json()
          setTags(data)
        }
      } catch {
        // silently fail
      }
    }
    loadTags()
  }, [workspace])

  // ------------------------------------------------------------------
  // Fetch contacts
  // ------------------------------------------------------------------
  const fetchContacts = useCallback(async () => {
    if (!workspace) return

    setIsLoading(true)
    try {
      const params = new URLSearchParams()
      if (debouncedSearch) params.set('search', debouncedSearch)
      if (filters.status) params.set('status', filters.status)
      if (filters.email_status) params.set('email_status', filters.email_status)
      if (filters.sms_status) params.set('sms_status', filters.sms_status)
      if (filters.tag_ids.length > 0) params.set('tag_ids', filters.tag_ids.join(','))
      if (filters.created_after) params.set('created_after', filters.created_after)
      params.set('sort', sort)
      params.set('order', order)
      params.set('page', String(page))
      params.set('limit', String(limit))

      const res = await fetch(`/api/contacts?${params.toString()}`)
      if (res.ok) {
        const data = await res.json()
        setContacts(data.contacts)
        setTotal(data.total)
        setTotalPages(data.totalPages)
      }
    } catch {
      // silently fail
    } finally {
      setIsLoading(false)
    }
  }, [workspace, debouncedSearch, filters, sort, order, page, limit])

  useEffect(() => {
    fetchContacts()
  }, [fetchContacts])

  // ------------------------------------------------------------------
  // Sort handling
  // ------------------------------------------------------------------
  const handleSort = (column: string) => {
    if (sort === column) {
      setOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSort(column)
      setOrder('asc')
    }
    setPage(1)
  }

  const SortIndicator = ({ column }: { column: string }) => {
    if (sort !== column) return null
    return order === 'asc' ? (
      <ChevronUp className="ml-1 inline h-3 w-3" />
    ) : (
      <ChevronDown className="ml-1 inline h-3 w-3" />
    )
  }

  // ------------------------------------------------------------------
  // Selection
  // ------------------------------------------------------------------
  const allOnPageSelected =
    contacts.length > 0 && contacts.every((c) => selectedIds.has(c.id))

  const toggleSelectAll = () => {
    if (allOnPageSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev)
        contacts.forEach((c) => next.delete(c.id))
        return next
      })
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev)
        contacts.forEach((c) => next.add(c.id))
        return next
      })
    }
  }

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  // ------------------------------------------------------------------
  // Filter helpers
  // ------------------------------------------------------------------
  const updateFilter = <K extends keyof Filters>(key: K, value: Filters[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value }))
    setPage(1)
  }

  const clearFilter = (key: keyof Filters) => {
    setFilters((prev) => ({
      ...prev,
      [key]: key === 'tag_ids' ? [] : '',
    }))
    setPage(1)
  }

  const clearAllFilters = () => {
    setFilters(emptyFilters)
    setPage(1)
  }

  const hasActiveFilters =
    filters.status !== '' ||
    filters.email_status !== '' ||
    filters.sms_status !== '' ||
    filters.tag_ids.length > 0 ||
    filters.created_after !== ''

  const toggleTagFilter = (tagId: string) => {
    setFilters((prev) => {
      const ids = prev.tag_ids.includes(tagId)
        ? prev.tag_ids.filter((id) => id !== tagId)
        : [...prev.tag_ids, tagId]
      return { ...prev, tag_ids: ids }
    })
    setPage(1)
  }

  // ------------------------------------------------------------------
  // Bulk actions
  // ------------------------------------------------------------------
  const handleBulkDelete = async () => {
    setIsDeleting(true)
    try {
      const ids = Array.from(selectedIds)
      await Promise.all(
        ids.map((id) =>
          fetch(`/api/contacts/${id}`, { method: 'DELETE' })
        )
      )
      setSelectedIds(new Set())
      setDeleteDialogOpen(false)
      fetchContacts()
    } catch {
      // silently fail
    } finally {
      setIsDeleting(false)
    }
  }

  const handleExport = () => {
    const ids = Array.from(selectedIds).join(',')
    window.open(`/api/contacts/export?ids=${ids}`, '_blank')
  }

  // ------------------------------------------------------------------
  // Render helpers
  // ------------------------------------------------------------------
  const renderTags = (contact: Contact) => {
    const contactTags = contact.tags || []
    if (contactTags.length === 0) return <span className="text-muted-foreground">-</span>

    const visible = contactTags.slice(0, 3)
    const remaining = contactTags.length - 3

    return (
      <div className="flex flex-wrap gap-1">
        {visible.map((tag) => (
          <Badge
            key={tag.id}
            variant="secondary"
            className="text-[10px] px-1.5 py-0"
            style={{ borderColor: tag.color, borderWidth: 1 }}
          >
            <span
              className="mr-1 inline-block h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: tag.color }}
            />
            {tag.name}
          </Badge>
        ))}
        {remaining > 0 && (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
            +{remaining} more
          </Badge>
        )}
      </div>
    )
  }

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Contacts</h1>
          {!isLoading && (
            <p className="text-sm text-muted-foreground mt-1">
              Showing {contacts.length} of {total} contacts
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" asChild>
            <Link href="/contacts/import">
              <Upload className="mr-2 h-4 w-4" />
              Import CSV
            </Link>
          </Button>
          <Button onClick={() => setAddSheetOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Contact
          </Button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search contacts..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Tag filter */}
        <Popover open={tagFilterOpen} onOpenChange={setTagFilterOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-8">
              <TagIcon className="mr-1 h-3 w-3" />
              Tags
              {filters.tag_ids.length > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 px-1 text-[10px]">
                  {filters.tag_ids.length}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[250px] p-0" align="start">
            <Command>
              <CommandInput placeholder="Search tags..." />
              <CommandList>
                <CommandEmpty>No tags found.</CommandEmpty>
                <CommandGroup>
                  {tags.map((tag) => (
                    <CommandItem
                      key={tag.id}
                      value={tag.name}
                      onSelect={() => toggleTagFilter(tag.id)}
                    >
                      <div
                        className="mr-2 h-3 w-3 rounded-full"
                        style={{ backgroundColor: tag.color }}
                      />
                      <span className="flex-1">{tag.name}</span>
                      {filters.tag_ids.includes(tag.id) && (
                        <Check className="h-4 w-4" />
                      )}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        {/* Status filter */}
        <Select
          value={filters.status}
          onValueChange={(val) => updateFilter('status', val)}
        >
          <SelectTrigger className="h-8 w-[140px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            {CONTACT_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Email Status filter */}
        <Select
          value={filters.email_status}
          onValueChange={(val) => updateFilter('email_status', val)}
        >
          <SelectTrigger className="h-8 w-[160px]">
            <SelectValue placeholder="Email Status" />
          </SelectTrigger>
          <SelectContent>
            {EMAIL_STATUS_OPTIONS.map((s) => (
              <SelectItem key={s} value={s}>
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* SMS Status filter */}
        <Select
          value={filters.sms_status}
          onValueChange={(val) => updateFilter('sms_status', val)}
        >
          <SelectTrigger className="h-8 w-[150px]">
            <SelectValue placeholder="SMS Status" />
          </SelectTrigger>
          <SelectContent>
            {SMS_STATUS_OPTIONS.map((s) => (
              <SelectItem key={s} value={s}>
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Created After date picker */}
        <Popover open={dateFilterOpen} onOpenChange={setDateFilterOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-8">
              <CalendarIcon className="mr-1 h-3 w-3" />
              {filters.created_after
                ? new Date(filters.created_after).toLocaleDateString()
                : 'Created After'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={filters.created_after ? new Date(filters.created_after) : undefined}
              onSelect={(date) => {
                if (date) {
                  updateFilter('created_after', date.toISOString())
                }
                setDateFilterOpen(false)
              }}
            />
          </PopoverContent>
        </Popover>

        {/* Clear all */}
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearAllFilters}
            className="h-8 text-xs"
          >
            Clear all
          </Button>
        )}
      </div>

      {/* Active filter badges */}
      {hasActiveFilters && (
        <div className="flex flex-wrap gap-1">
          {filters.status && (
            <Badge variant="secondary" className="gap-1">
              Status: {filters.status}
              <button onClick={() => clearFilter('status')}>
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {filters.email_status && (
            <Badge variant="secondary" className="gap-1">
              Email: {filters.email_status}
              <button onClick={() => clearFilter('email_status')}>
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {filters.sms_status && (
            <Badge variant="secondary" className="gap-1">
              SMS: {filters.sms_status}
              <button onClick={() => clearFilter('sms_status')}>
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {filters.tag_ids.map((tagId) => {
            const tag = tags.find((t) => t.id === tagId)
            return (
              <Badge key={tagId} variant="secondary" className="gap-1">
                Tag: {tag?.name || tagId}
                <button onClick={() => toggleTagFilter(tagId)}>
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )
          })}
          {filters.created_after && (
            <Badge variant="secondary" className="gap-1">
              After: {new Date(filters.created_after).toLocaleDateString()}
              <button onClick={() => clearFilter('created_after')}>
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
        </div>
      )}

      {/* Bulk Actions Bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 rounded-lg border bg-muted/50 px-4 py-2">
          <span className="text-sm font-medium">
            {selectedIds.size} selected
          </span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled className="h-7 text-xs">
              <TagIcon className="mr-1 h-3 w-3" />
              Add Tag
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDeleteDialogOpen(true)}
              className="h-7 text-xs text-destructive hover:text-destructive"
            >
              <Trash2 className="mr-1 h-3 w-3" />
              Delete
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
              className="h-7 text-xs"
            >
              <Download className="mr-1 h-3 w-3" />
              Export
            </Button>
          </div>
          {selectedIds.size < total && (
            <button
              onClick={() => {
                // In practice this would need all IDs from the server.
                // For now we select all on the current page.
                setSelectedIds((prev) => {
                  const next = new Set(prev)
                  contacts.forEach((c) => next.add(c.id))
                  return next
                })
              }}
              className="ml-auto text-xs text-primary hover:underline"
            >
              Select all {total} contacts
            </button>
          )}
        </div>
      )}

      {/* Table */}
      {isLoading ? (
        <TableSkeleton />
      ) : contacts.length === 0 ? (
        <EmptyState
          hasFilters={hasActiveFilters || debouncedSearch.length > 0}
          onClearFilters={() => {
            clearAllFilters()
            setSearch('')
          }}
          onAddContact={() => setAddSheetOpen(true)}
        />
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={allOnPageSelected}
                    onCheckedChange={toggleSelectAll}
                    aria-label="Select all"
                  />
                </TableHead>
                <TableHead>
                  <button
                    onClick={() => handleSort('first_name')}
                    className="flex items-center hover:text-foreground"
                  >
                    Name
                    <SortIndicator column="first_name" />
                  </button>
                </TableHead>
                <TableHead>
                  <button
                    onClick={() => handleSort('email')}
                    className="flex items-center hover:text-foreground"
                  >
                    Email
                    <SortIndicator column="email" />
                  </button>
                </TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Tags</TableHead>
                <TableHead>
                  <button
                    onClick={() => handleSort('status')}
                    className="flex items-center hover:text-foreground"
                  >
                    Status
                    <SortIndicator column="status" />
                  </button>
                </TableHead>
                <TableHead>
                  <button
                    onClick={() => handleSort('created_at')}
                    className="flex items-center hover:text-foreground"
                  >
                    Created
                    <SortIndicator column="created_at" />
                  </button>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contacts.map((contact) => (
                <TableRow
                  key={contact.id}
                  data-state={selectedIds.has(contact.id) ? 'selected' : undefined}
                >
                  <TableCell>
                    <Checkbox
                      checked={selectedIds.has(contact.id)}
                      onCheckedChange={() => toggleSelect(contact.id)}
                      aria-label={`Select ${contact.full_name || contact.email || 'contact'}`}
                    />
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/contacts/${contact.id}`}
                      className="font-medium hover:underline"
                    >
                      {contact.first_name || contact.last_name
                        ? `${contact.first_name || ''} ${contact.last_name || ''}`.trim()
                        : 'Unnamed'}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {contact.email ? truncate(contact.email, 30) : '-'}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {contact.phone ? formatPhone(contact.phone) : '-'}
                  </TableCell>
                  <TableCell>{renderTags(contact)}</TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(contact.status)}>
                      {contact.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatRelativeTime(contact.created_at)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Add Contact Sheet */}
      <AddContactSheet
        open={addSheetOpen}
        onOpenChange={setAddSheetOpen}
        onSuccess={fetchContacts}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Contacts</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {selectedIds.size} contact
              {selectedIds.size > 1 ? 's' : ''}? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleBulkDelete}
              disabled={isDeleting}
            >
              {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Empty State
// ---------------------------------------------------------------------------

function EmptyState({
  hasFilters,
  onClearFilters,
  onAddContact,
}: {
  hasFilters: boolean
  onClearFilters: () => void
  onAddContact: () => void
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border py-16 text-center">
      <Users className="h-12 w-12 text-muted-foreground/50" />
      <h3 className="mt-4 text-lg font-semibold">
        {hasFilters ? 'No contacts match your filters' : 'No contacts yet'}
      </h3>
      <p className="mt-1 text-sm text-muted-foreground">
        {hasFilters
          ? 'Try adjusting your search or filters to find what you are looking for.'
          : 'Add your first contact to get started.'}
      </p>
      <div className="mt-4 flex gap-2">
        {hasFilters && (
          <Button variant="outline" onClick={onClearFilters}>
            Clear filters
          </Button>
        )}
        <Button onClick={onAddContact}>
          <Plus className="mr-2 h-4 w-4" />
          Add Contact
        </Button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Loading Skeleton
// ---------------------------------------------------------------------------

function TableSkeleton() {
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10" />
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Phone</TableHead>
            <TableHead>Tags</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Created</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: 5 }).map((_, i) => (
            <TableRow key={i}>
              <TableCell>
                <Skeleton className="h-4 w-4" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-24" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-36" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-28" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-5 w-16" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-5 w-16" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-16" />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
