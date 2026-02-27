'use client'

import { useState, useEffect, useCallback } from 'react'
import { TAG_COLORS } from '@/lib/constants'
import type { Tag } from '@/lib/types'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

import { Check, Loader2, Pencil, Plus, Trash2 } from 'lucide-react'

interface TagManagerProps {
  workspaceId: string
}

export function TagManager({ workspaceId }: TagManagerProps) {
  const [tags, setTags] = useState<Tag[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Create form state
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [createName, setCreateName] = useState('')
  const [createColor, setCreateColor] = useState<string>(TAG_COLORS[0])
  const [isCreating, setIsCreating] = useState(false)

  // Edit form state
  const [editingTagId, setEditingTagId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editColor, setEditColor] = useState('')
  const [isSavingEdit, setIsSavingEdit] = useState(false)

  // Delete state
  const [deleteTag, setDeleteTag] = useState<Tag | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // ---------------------------------------------------------------
  // Fetch tags
  // ---------------------------------------------------------------
  const fetchTags = useCallback(async () => {
    try {
      const res = await fetch('/api/tags')
      if (res.ok) {
        const data = await res.json()
        setTags(data)
      }
    } catch {
      // silently fail
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (workspaceId) {
      fetchTags()
    }
  }, [workspaceId, fetchTags])

  // ---------------------------------------------------------------
  // Create tag
  // ---------------------------------------------------------------
  const handleCreate = async () => {
    if (!createName.trim()) return

    setIsCreating(true)
    try {
      const res = await fetch('/api/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: createName.trim(), color: createColor }),
      })

      if (res.ok) {
        const tag: Tag = await res.json()
        setTags((prev) => [...prev, tag])
        setCreateName('')
        setCreateColor(TAG_COLORS[0])
        setShowCreateForm(false)
      }
    } catch {
      // silently fail
    } finally {
      setIsCreating(false)
    }
  }

  // ---------------------------------------------------------------
  // Edit tag
  // ---------------------------------------------------------------
  const startEdit = (tag: Tag) => {
    setEditingTagId(tag.id)
    setEditName(tag.name)
    setEditColor(tag.color)
  }

  const cancelEdit = () => {
    setEditingTagId(null)
    setEditName('')
    setEditColor('')
  }

  const handleSaveEdit = async () => {
    if (!editingTagId || !editName.trim()) return

    setIsSavingEdit(true)
    try {
      const res = await fetch(`/api/tags/${editingTagId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editName.trim(), color: editColor }),
      })

      if (res.ok) {
        const updated: Tag = await res.json()
        setTags((prev) => prev.map((t) => (t.id === updated.id ? updated : t)))
        cancelEdit()
      }
    } catch {
      // silently fail
    } finally {
      setIsSavingEdit(false)
    }
  }

  // ---------------------------------------------------------------
  // Delete tag
  // ---------------------------------------------------------------
  const handleDelete = async () => {
    if (!deleteTag) return

    setIsDeleting(true)
    try {
      const res = await fetch(`/api/tags/${deleteTag.id}`, {
        method: 'DELETE',
      })

      if (res.ok) {
        setTags((prev) => prev.filter((t) => t.id !== deleteTag.id))
        setDeleteTag(null)
      }
    } catch {
      // silently fail
    } finally {
      setIsDeleting(false)
    }
  }

  // ---------------------------------------------------------------
  // Color picker component
  // ---------------------------------------------------------------
  const ColorPicker = ({
    selected,
    onSelect,
  }: {
    selected: string
    onSelect: (color: string) => void
  }) => (
    <div className="flex flex-wrap gap-1.5">
      {TAG_COLORS.map((color) => (
        <button
          key={color}
          type="button"
          onClick={() => onSelect(color)}
          className="relative h-6 w-6 rounded-full transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          style={{ backgroundColor: color }}
        >
          {selected === color && (
            <span className="absolute inset-0 flex items-center justify-center">
              <Check className="h-3.5 w-3.5 text-white" />
            </span>
          )}
          {selected === color && (
            <span
              className="absolute -inset-0.5 rounded-full border-2"
              style={{ borderColor: color }}
            />
          )}
        </button>
      ))}
    </div>
  )

  // ---------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Loading tags...
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Tags</h3>
        {!showCreateForm && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowCreateForm(true)}
            className="h-7 text-xs"
          >
            <Plus className="mr-1 h-3 w-3" />
            Create Tag
          </Button>
        )}
      </div>

      {/* Create form */}
      {showCreateForm && (
        <div className="rounded-md border p-3 space-y-3">
          <Input
            placeholder="Tag name"
            value={createName}
            onChange={(e) => setCreateName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                handleCreate()
              }
            }}
            className="h-8 text-sm"
            autoFocus
          />
          <ColorPicker selected={createColor} onSelect={setCreateColor} />
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setShowCreateForm(false)
                setCreateName('')
                setCreateColor(TAG_COLORS[0])
              }}
              className="h-7 text-xs"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleCreate}
              disabled={!createName.trim() || isCreating}
              className="h-7 text-xs"
            >
              {isCreating && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
              Save
            </Button>
          </div>
        </div>
      )}

      {/* Tag list */}
      {tags.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted-foreground">
          No tags yet. Create your first tag to organize contacts.
        </p>
      ) : (
        <div className="space-y-1">
          {tags.map((tag) =>
            editingTagId === tag.id ? (
              /* Inline edit form */
              <div key={tag.id} className="rounded-md border p-3 space-y-3">
                <Input
                  placeholder="Tag name"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      handleSaveEdit()
                    }
                    if (e.key === 'Escape') {
                      cancelEdit()
                    }
                  }}
                  className="h-8 text-sm"
                  autoFocus
                />
                <ColorPicker selected={editColor} onSelect={setEditColor} />
                <div className="flex justify-end gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={cancelEdit}
                    className="h-7 text-xs"
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleSaveEdit}
                    disabled={!editName.trim() || isSavingEdit}
                    className="h-7 text-xs"
                  >
                    {isSavingEdit && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
                    Save
                  </Button>
                </div>
              </div>
            ) : (
              /* Tag row */
              <div
                key={tag.id}
                className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted/50 group"
              >
                <span
                  className="h-3 w-3 shrink-0 rounded-full"
                  style={{ backgroundColor: tag.color }}
                />
                <span className="flex-1 text-sm truncate">{tag.name}</span>
                {typeof tag.contact_count === 'number' && (
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                    {tag.contact_count}
                  </Badge>
                )}
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => startEdit(tag)}
                    className="h-6 w-6 p-0"
                  >
                    <Pencil className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDeleteTag(tag)}
                    className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            )
          )}
        </div>
      )}

      {/* Delete confirmation dialog */}
      <Dialog open={!!deleteTag} onOpenChange={(open) => !open && setDeleteTag(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Tag</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the tag &ldquo;{deleteTag?.name}&rdquo;?
              This will remove it from all contacts. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteTag(null)}
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
