'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useWorkspace } from '@/lib/hooks/use-workspace'
import { formatPhone, formatRelativeTime, truncate } from '@/lib/utils/format'
import type { Contact, Tag } from '@/lib/types'

import { AddContactSheet } from '@/components/contacts/add-contact-sheet'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Skeleton } from '@/components/ui/skeleton'
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
  Filter,
  ChevronLeft,
  ChevronRight,
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

// Status tab options for quick filtering
const STATUS_TABS = [
  { label: 'All', value: '' },
  { label: 'Subscribed', value: 'subscribed' },
  { label: 'Unsubscribed', value: 'unsubscribed' },
  { label: 'Suppressed', value: 'suppressed' },
]

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
  const [activeTab, setActiveTab] = useState('')

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
      setPage(1)
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
    setActiveTab('')
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
  // Tab handling
  // ------------------------------------------------------------------
  const handleTabChange = (value: string) => {
    setActiveTab(value)
    updateFilter('status', value)
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
    if (contactTags.length === 0) return <span className="text-slate-500">—</span>

    const visible = contactTags.slice(0, 2)
    const remaining = contactTags.length - 2

    return (
      <div className="flex flex-wrap gap-1">
        {visible.map((tag) => (
          <span
            key={tag.id}
            className="inline-flex items-center gap-1 rounded-full bg-slate-700/50 px-2 py-0.5 text-[11px] text-slate-300"
          >
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: tag.color }}
            />
            {tag.name}
          </span>
        ))}
        {remaining > 0 && (
          <span className="inline-flex items-center rounded-full bg-slate-700/30 px-2 py-0.5 text-[11px] text-slate-500">
            +{remaining}
          </span>
        )}
      </div>
    )
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'subscribed':
      case 'active':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
      case 'unsubscribed':
        return 'bg-orange-500/10 text-orange-400 border-orange-500/20'
      case 'bounced':
      case 'complained':
      case 'suppressed':
        return 'bg-red-500/10 text-red-400 border-red-500/20'
      default:
        return 'bg-slate-500/10 text-slate-400 border-slate-500/20'
    }
  }

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------
  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Contacts</h1>
          {!isLoading && (
            <p className="text-sm text-slate-400 mt-1">
              {total.toLocaleString()} total contacts
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" asChild className="border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white">
            <Link href="/contacts/import">
              <Upload className="mr-2 h-4 w-4" />
              Import
            </Link>
          </Button>
          <Button className="bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/20">
            <Plus className="mr-2 h-4 w-4" />
            Add Contact
          </Button>
        </div>
      </div>

      {/* Status Tabs + Search + Filters */}
      <div className="bg-card rounded-xl border border-slate-800 shadow-sm">
        {/* Tab Bar */}
        <div className="flex items-center gap-6 px-6 pt-5 pb-4 border-b border-slate-800">
          <div className="flex items-center gap-1 bg-slate-800/60 rounded-lg p-1">
            {STATUS_TABS.map((tab) => (
              <button
                key={tab.value}
                onClick={() => handleTabChange(tab.value)}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  activeTab === tab.value
                    ? 'bg-primary text-white shadow-sm'
                    : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className="flex-1" />
          <div className="flex items-center gap-2">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search contacts..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 pr-4 py-2 rounded-lg border border-slate-700 bg-slate-800/50 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary w-64"
              />
            </div>
            {/* Filter dropdown */}
            <Popover>
              <PopoverTrigger asChild>
                <button className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-700 bg-slate-800/50 text-sm text-slate-300 hover:bg-slate-700 transition-colors">
                  <Filter className="h-4 w-4" />
                  Filters
                  {hasActiveFilters && (
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] text-white font-bold">
                      {(filters.email_status ? 1 : 0) + (filters.sms_status ? 1 : 0) + filters.tag_ids.length + (filters.created_after ? 1 : 0)}
                    </span>
                  )}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-[320px] p-4 bg-card border-slate-700" align="end">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold">Filters</h4>
                    {hasActiveFilters && (
                      <button onClick={clearAllFilters} className="text-xs text-primary hover:underline">
                        Clear all
                      </button>
                    )}
                  </div>

                  {/* Tag filter */}
                  <div className="space-y-2">
                    <label className="text-xs text-slate-400 font-medium">Tags</label>
                    <Popover open={tagFilterOpen} onOpenChange={setTagFilterOpen}>
                      <PopoverTrigger asChild>
                        <button className="w-full flex items-center justify-between px-3 py-2 rounded-lg border border-slate-700 bg-slate-800/50 text-sm text-slate-300 hover:bg-slate-700">
                          <span>{filters.tag_ids.length > 0 ? `${filters.tag_ids.length} selected` : 'Select tags...'}</span>
                          <TagIcon className="h-3 w-3 text-slate-500" />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[250px] p-0 bg-card border-slate-700" align="start">
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
                                    <Check className="h-4 w-4 text-primary" />
                                  )}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>

                  {/* Email Status filter */}
                  <div className="space-y-2">
                    <label className="text-xs text-slate-400 font-medium">Email Status</label>
                    <Select
                      value={filters.email_status}
                      onValueChange={(val) => updateFilter('email_status', val)}
                    >
                      <SelectTrigger className="border-slate-700 bg-slate-800/50 text-slate-300">
                        <SelectValue placeholder="Any" />
                      </SelectTrigger>
                      <SelectContent>
                        {EMAIL_STATUS_OPTIONS.map((s) => (
                          <SelectItem key={s} value={s}>
                            {s.charAt(0).toUpperCase() + s.slice(1)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* SMS Status filter */}
                  <div className="space-y-2">
                    <label className="text-xs text-slate-400 font-medium">SMS Status</label>
                    <Select
                      value={filters.sms_status}
                      onValueChange={(val) => updateFilter('sms_status', val)}
                    >
                      <SelectTrigger className="border-slate-700 bg-slate-800/50 text-slate-300">
                        <SelectValue placeholder="Any" />
                      </SelectTrigger>
                      <SelectContent>
                        {SMS_STATUS_OPTIONS.map((s) => (
                          <SelectItem key={s} value={s}>
                            {s.charAt(0).toUpperCase() + s.slice(1)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Created After */}
                  <div className="space-y-2">
                    <label className="text-xs text-slate-400 font-medium">Created After</label>
                    <Popover open={dateFilterOpen} onOpenChange={setDateFilterOpen}>
                      <PopoverTrigger asChild>
                        <button className="w-full flex items-center justify-between px-3 py-2 rounded-lg border border-slate-700 bg-slate-800/50 text-sm text-slate-300 hover:bg-slate-700">
                          <span>
                            {filters.created_after
                              ? new Date(filters.created_after).toLocaleDateString()
                              : 'Select date...'}
                          </span>
                          <CalendarIcon className="h-3 w-3 text-slate-500" />
                        </button>
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
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* Active filter badges */}
        {hasActiveFilters && (
          <div className="flex flex-wrap gap-2 px-6 py-3 border-b border-slate-800 bg-slate-800/20">
            {filters.status && filters.status !== activeTab && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-700/50 px-3 py-1 text-xs text-slate-300">
                Status: {filters.status}
                <button onClick={() => clearFilter('status')} className="hover:text-white">
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}
            {filters.email_status && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-700/50 px-3 py-1 text-xs text-slate-300">
                Email: {filters.email_status}
                <button onClick={() => clearFilter('email_status')} className="hover:text-white">
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}
            {filters.sms_status && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-700/50 px-3 py-1 text-xs text-slate-300">
                SMS: {filters.sms_status}
                <button onClick={() => clearFilter('sms_status')} className="hover:text-white">
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}
            {filters.tag_ids.map((tagId) => {
              const tag = tags.find((t) => t.id === tagId)
              return (
                <span key={tagId} className="inline-flex items-center gap-1.5 rounded-full bg-slate-700/50 px-3 py-1 text-xs text-slate-300">
                  Tag: {tag?.name || tagId}
                  <button onClick={() => toggleTagFilter(tagId)} className="hover:text-white">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )
            })}
            {filters.created_after && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-700/50 px-3 py-1 text-xs text-slate-300">
                After: {new Date(filters.created_after).toLocaleDateString()}
                <button onClick={() => clearFilter('created_after')} className="hover:text-white">
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}
            <button onClick={clearAllFilters} className="text-xs text-primary hover:underline ml-2">
              Clear all
            </button>
          </div>
        )}

        {/* Table */}
        {isLoading ? (
          <ContactsTableSkeleton />
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
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-800">
                  <th className="w-12 px-4 py-3">
                    <Checkbox
                      checked={allOnPageSelected}
                      onCheckedChange={toggleSelectAll}
                      aria-label="Select all"
                    />
                  </th>
                  <th className="px-4 py-3 text-left">
                    <button
                      onClick={() => handleSort('first_name')}
                      className="flex items-center text-xs font-semibold text-slate-400 uppercase tracking-wider hover:text-white transition-colors"
                    >
                      Name
                      <SortIndicator column="first_name" />
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left">
                    <button
                      onClick={() => handleSort('email')}
                      className="flex items-center text-xs font-semibold text-slate-400 uppercase tracking-wider hover:text-white transition-colors"
                    >
                      Email
                      <SortIndicator column="email" />
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left">
                    <button
                      onClick={() => handleSort('status')}
                      className="flex items-center text-xs font-semibold text-slate-400 uppercase tracking-wider hover:text-white transition-colors"
                    >
                      Status
                      <SortIndicator column="status" />
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left">
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Tags</span>
                  </th>
                  <th className="px-4 py-3 text-left">
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Phone</span>
                  </th>
                  <th className="px-4 py-3 text-left">
                    <button
                      onClick={() => handleSort('created_at')}
                      className="flex items-center text-xs font-semibold text-slate-400 uppercase tracking-wider hover:text-white transition-colors"
                    >
                      Added
                      <SortIndicator column="created_at" />
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {contacts.map((contact) => (
                  <tr
                    key={contact.id}
                    className={`transition-colors hover:bg-slate-800/30 ${
                      selectedIds.has(contact.id) ? 'bg-primary/5' : ''
                    }`}
                  >
                    <td className="px-4 py-3">
                      <Checkbox
                        checked={selectedIds.has(contact.id)}
                        onCheckedChange={() => toggleSelect(contact.id)}
                        aria-label={`Select ${contact.full_name || contact.email || 'contact'}`}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/contacts/${contact.id}`}
                        className="flex items-center gap-3 group"
                      >
                        <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary text-xs font-bold shrink-0">
                          {(contact.first_name?.[0] || contact.email?.[0] || 'U').toUpperCase()}
                        </div>
                        <span className="text-sm font-medium text-white group-hover:text-primary transition-colors">
                          {contact.first_name || contact.last_name
                            ? `${contact.first_name || ''} ${contact.last_name || ''}`.trim()
                            : 'Unnamed'}
                        </span>
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-slate-400">
                        {contact.email ? truncate(contact.email, 30) : '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${getStatusColor(contact.status)}`}>
                        {contact.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">{renderTags(contact)}</td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-slate-400">
                        {contact.phone ? formatPhone(contact.phone) : '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-slate-500">
                        {formatRelativeTime(contact.created_at)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-slate-800">
            <p className="text-sm text-slate-500">
              Showing {(page - 1) * limit + 1}–{Math.min(page * limit, total)} of {total}
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const pageNum = i + 1
                return (
                  <button
                    key={pageNum}
                    onClick={() => setPage(pageNum)}
                    className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${
                      page === pageNum
                        ? 'bg-primary text-white'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800'
                    }`}
                  >
                    {pageNum}
                  </button>
                )
              })}
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Floating Bulk Action Bar */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
          <div className="flex items-center gap-4 bg-slate-900 border border-slate-700 rounded-xl px-6 py-3 shadow-2xl shadow-black/50">
            <span className="text-sm font-medium text-white">
              {selectedIds.size} selected
            </span>
            <div className="w-px h-6 bg-slate-700" />
            <div className="flex items-center gap-2">
              <button
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
                disabled
              >
                <TagIcon className="h-3.5 w-3.5" />
                Add Tag
              </button>
              <button
                onClick={handleExport}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
              >
                <Download className="h-3.5 w-3.5" />
                Export
              </button>
              <button
                onClick={() => setDeleteDialogOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-red-400 hover:bg-red-500/10 transition-colors"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete
              </button>
            </div>
            <div className="w-px h-6 bg-slate-700" />
            <button
              onClick={() => setSelectedIds(new Set())}
              className="text-slate-400 hover:text-white transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
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
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center mb-4">
        <Users className="h-8 w-8 text-slate-600" />
      </div>
      <h3 className="text-lg font-semibold text-white">
        {hasFilters ? 'No contacts match your filters' : 'No contacts yet'}
      </h3>
      <p className="mt-2 text-sm text-slate-500 max-w-sm">
        {hasFilters
          ? 'Try adjusting your search or filters to find what you are looking for.'
          : 'Import contacts from a CSV file or add them manually to get started.'}
      </p>
      <div className="mt-6 flex gap-3">
        {hasFilters && (
          <Button variant="outline" onClick={onClearFilters} className="border-slate-700 text-slate-300">
            Clear filters
          </Button>
        )}
        <Button onClick={onAddContact} className="bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/20">
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

function ContactsTableSkeleton() {
  return (
    <div className="px-6 py-4">
      <div className="space-y-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4">
            <Skeleton className="h-4 w-4 rounded bg-slate-800" />
            <Skeleton className="h-8 w-8 rounded-full bg-slate-800" />
            <Skeleton className="h-4 w-32 bg-slate-800" />
            <Skeleton className="h-4 w-48 bg-slate-800" />
            <Skeleton className="h-5 w-20 rounded-full bg-slate-800" />
            <Skeleton className="h-5 w-16 bg-slate-800" />
            <Skeleton className="h-4 w-28 bg-slate-800" />
            <Skeleton className="h-4 w-20 bg-slate-800" />
          </div>
        ))}
      </div>
    </div>
  )
}
