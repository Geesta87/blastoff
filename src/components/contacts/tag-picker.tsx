'use client'

import { useState, useEffect, useCallback } from 'react'
import { TAG_COLORS } from '@/lib/constants'
import type { Tag } from '@/lib/types'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
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
  CommandSeparator,
} from '@/components/ui/command'

import { Check, ChevronsUpDown, Loader2, Plus, X } from 'lucide-react'

interface TagPickerProps {
  selectedTagIds: string[]
  onTagsChange: (tagIds: string[]) => void
  workspaceId: string
}

export function TagPicker({ selectedTagIds, onTagsChange, workspaceId }: TagPickerProps) {
  const [tags, setTags] = useState<Tag[]>([])
  const [open, setOpen] = useState(false)
  const [newTagName, setNewTagName] = useState('')
  const [isCreating, setIsCreating] = useState(false)

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
    }
  }, [])

  useEffect(() => {
    if (workspaceId) {
      fetchTags()
    }
  }, [workspaceId, fetchTags])

  // ---------------------------------------------------------------
  // Toggle selection
  // ---------------------------------------------------------------
  const toggleTag = (tagId: string) => {
    if (selectedTagIds.includes(tagId)) {
      onTagsChange(selectedTagIds.filter((id) => id !== tagId))
    } else {
      onTagsChange([...selectedTagIds, tagId])
    }
  }

  const removeTag = (tagId: string) => {
    onTagsChange(selectedTagIds.filter((id) => id !== tagId))
  }

  // ---------------------------------------------------------------
  // Create tag
  // ---------------------------------------------------------------
  const createTag = async () => {
    if (!newTagName.trim()) return

    setIsCreating(true)
    try {
      const color = TAG_COLORS[Math.floor(Math.random() * TAG_COLORS.length)]
      const res = await fetch('/api/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newTagName.trim(), color }),
      })

      if (res.ok) {
        const tag: Tag = await res.json()
        setTags((prev) => [...prev, tag])
        onTagsChange([...selectedTagIds, tag.id])
        setNewTagName('')
      }
    } catch {
      // silently fail
    } finally {
      setIsCreating(false)
    }
  }

  // ---------------------------------------------------------------
  // Derived state
  // ---------------------------------------------------------------
  const selectedTags = tags.filter((t) => selectedTagIds.includes(t.id))

  // ---------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------
  return (
    <div className="space-y-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between font-normal"
          >
            {selectedTagIds.length > 0
              ? `${selectedTagIds.length} tag${selectedTagIds.length > 1 ? 's' : ''} selected`
              : 'Select tags...'}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[300px] p-0" align="start">
          <Command>
            <CommandInput placeholder="Search tags..." />
            <CommandList>
              <CommandEmpty>No tags found.</CommandEmpty>
              <CommandGroup>
                {tags.map((tag) => (
                  <CommandItem
                    key={tag.id}
                    value={tag.name}
                    onSelect={() => toggleTag(tag.id)}
                  >
                    <div
                      className="mr-2 h-3 w-3 rounded-full"
                      style={{ backgroundColor: tag.color }}
                    />
                    <span className="flex-1">{tag.name}</span>
                    {selectedTagIds.includes(tag.id) && (
                      <Check className="h-4 w-4" />
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
              <CommandSeparator />
              <CommandGroup>
                <div className="flex items-center gap-2 p-2">
                  <Input
                    placeholder="Create new tag..."
                    value={newTagName}
                    onChange={(e) => setNewTagName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        e.stopPropagation()
                        createTag()
                      }
                    }}
                    className="h-8 text-sm"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={createTag}
                    disabled={!newTagName.trim() || isCreating}
                    className="h-8 shrink-0"
                  >
                    {isCreating ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Plus className="h-3 w-3" />
                    )}
                  </Button>
                </div>
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {/* Selected tags display */}
      {selectedTags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selectedTags.map((tag) => (
            <Badge
              key={tag.id}
              variant="secondary"
              className="gap-1"
              style={{ borderColor: tag.color, borderWidth: 1 }}
            >
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: tag.color }}
              />
              {tag.name}
              <button
                type="button"
                onClick={() => removeTag(tag.id)}
                className="ml-0.5 rounded-full hover:bg-muted"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  )
}
