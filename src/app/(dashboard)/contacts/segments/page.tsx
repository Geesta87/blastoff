'use client'

import { useState, useEffect, useCallback } from 'react'
import { useWorkspace } from '@/lib/hooks/use-workspace'
import { formatRelativeTime } from '@/lib/utils/format'
import type { Segment } from '@/lib/types'

import { SegmentBuilder } from '@/components/segments/segment-builder'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

import { Loader2, MoreHorizontal, Pencil, Plus, Trash2, Filter } from 'lucide-react'

export default function SegmentsPage() {
  const { workspace } = useWorkspace()

  // Data
  const [segments, setSegments] = useState<Segment[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // UI state
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editingSegment, setEditingSegment] = useState<Segment | undefined>(undefined)
  const [deleteSegment, setDeleteSegment] = useState<Segment | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // ---------------------------------------------------------------
  // Fetch segments
  // ---------------------------------------------------------------
  const fetchSegments = useCallback(async () => {
    if (!workspace) return

    setIsLoading(true)
    try {
      const res = await fetch('/api/segments')
      if (res.ok) {
        const data = await res.json()
        setSegments(Array.isArray(data) ? data : data.segments || [])
      }
    } catch {
      // silently fail
    } finally {
      setIsLoading(false)
    }
  }, [workspace])

  useEffect(() => {
    fetchSegments()
  }, [fetchSegments])

  // ---------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------
  const handleNewSegment = () => {
    setEditingSegment(undefined)
    setSheetOpen(true)
  }

  const handleEditSegment = (segment: Segment) => {
    setEditingSegment(segment)
    setSheetOpen(true)
  }

  const handleSave = (saved: Segment) => {
    if (editingSegment) {
      // Update existing
      setSegments((prev) => prev.map((s) => (s.id === saved.id ? saved : s)))
    } else {
      // Add new
      setSegments((prev) => [saved, ...prev])
    }
    setSheetOpen(false)
    setEditingSegment(undefined)
  }

  const handleCancel = () => {
    setSheetOpen(false)
    setEditingSegment(undefined)
  }

  const handleDelete = async () => {
    if (!deleteSegment) return

    setIsDeleting(true)
    try {
      const res = await fetch(`/api/segments/${deleteSegment.id}`, {
        method: 'DELETE',
      })

      if (res.ok) {
        setSegments((prev) => prev.filter((s) => s.id !== deleteSegment.id))
        setDeleteSegment(null)
      }
    } catch {
      // silently fail
    } finally {
      setIsDeleting(false)
    }
  }

  // ---------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------
  const getRulesSummary = (segment: Segment): string => {
    const rules = segment.filter_rules
    if (!rules?.conditions?.length) return 'No conditions'
    const count = rules.conditions.length
    return `${count} condition${count !== 1 ? 's' : ''}, ${rules.operator}`
  }

  // ---------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Segments</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Create dynamic or static segments to target groups of contacts.
          </p>
        </div>
        <Button onClick={handleNewSegment}>
          <Plus className="mr-2 h-4 w-4" />
          New Segment
        </Button>
      </div>

      {/* Segments list */}
      {isLoading ? (
        <LoadingSkeleton />
      ) : segments.length === 0 ? (
        <EmptyState onCreateSegment={handleNewSegment} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {segments.map((segment) => (
            <Card
              key={segment.id}
              className="cursor-pointer transition-shadow hover:shadow-md"
              onClick={() => handleEditSegment(segment)}
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-base leading-tight">
                    {segment.name}
                  </CardTitle>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 shrink-0"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation()
                          handleEditSegment(segment)
                        }}
                      >
                        <Pencil className="mr-2 h-4 w-4" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation()
                          setDeleteSegment(segment)
                        }}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {segment.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {segment.description}
                  </p>
                )}
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="secondary">
                    {segment.contact_count} contact{segment.contact_count !== 1 ? 's' : ''}
                  </Badge>
                  <Badge variant="outline" className="gap-1">
                    <Filter className="h-3 w-3" />
                    {getRulesSummary(segment)}
                  </Badge>
                  {segment.is_dynamic && (
                    <Badge variant="outline" className="text-[10px]">
                      Dynamic
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Updated {formatRelativeTime(segment.updated_at)}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Segment builder sheet */}
      <Sheet open={sheetOpen} onOpenChange={(open) => !open && handleCancel()}>
        <SheetContent className="sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>
              {editingSegment ? 'Edit Segment' : 'New Segment'}
            </SheetTitle>
            <SheetDescription>
              {editingSegment
                ? 'Update the segment rules and settings.'
                : 'Define rules to group contacts into a segment.'}
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6">
            <SegmentBuilder
              segment={editingSegment}
              onSave={handleSave}
              onCancel={handleCancel}
            />
          </div>
        </SheetContent>
      </Sheet>

      {/* Delete confirmation dialog */}
      <Dialog open={!!deleteSegment} onOpenChange={(open) => !open && setDeleteSegment(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Segment</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the segment &ldquo;{deleteSegment?.name}&rdquo;?
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteSegment(null)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
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

// ---------------------------------------------------------------
// Empty State
// ---------------------------------------------------------------

function EmptyState({ onCreateSegment }: { onCreateSegment: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border py-16 text-center">
      <Filter className="h-12 w-12 text-muted-foreground/50" />
      <h3 className="mt-4 text-lg font-semibold">No segments yet</h3>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        Segments let you group contacts based on rules like tags, status, or activity.
        Create your first segment to get started.
      </p>
      <Button className="mt-4" onClick={onCreateSegment}>
        <Plus className="mr-2 h-4 w-4" />
        New Segment
      </Button>
    </div>
  )
}

// ---------------------------------------------------------------
// Loading Skeleton
// ---------------------------------------------------------------

function LoadingSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <Card key={i}>
          <CardHeader className="pb-2">
            <Skeleton className="h-5 w-32" />
          </CardHeader>
          <CardContent className="space-y-3">
            <Skeleton className="h-4 w-full" />
            <div className="flex gap-2">
              <Skeleton className="h-5 w-20" />
              <Skeleton className="h-5 w-28" />
            </div>
            <Skeleton className="h-3 w-24" />
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
