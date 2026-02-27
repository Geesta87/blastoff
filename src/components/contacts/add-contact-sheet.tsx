'use client'

import { useState, useEffect, useCallback } from 'react'
import { useWorkspace } from '@/lib/hooks/use-workspace'
import { TAG_COLORS } from '@/lib/constants'
import type { Tag } from '@/lib/types'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/components/ui/sheet'
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
  CommandSeparator,
} from '@/components/ui/command'
import { Checkbox } from '@/components/ui/checkbox'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Check, ChevronsUpDown, Loader2, Plus, X } from 'lucide-react'

interface AddContactSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

interface CustomField {
  key: string
  value: string
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const SOURCES = [
  { value: 'manual', label: 'Manual' },
  { value: 'import', label: 'Import' },
  { value: 'api', label: 'API' },
  { value: 'form', label: 'Form' },
  { value: 'automation', label: 'Automation' },
]

export function AddContactSheet({ open, onOpenChange, onSuccess }: AddContactSheetProps) {
  const { workspace } = useWorkspace()

  // Form state
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [source, setSource] = useState('manual')
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([])
  const [customFields, setCustomFields] = useState<CustomField[]>([])
  const [addAnother, setAddAnother] = useState(false)

  // Tag state
  const [tags, setTags] = useState<Tag[]>([])
  const [tagPopoverOpen, setTagPopoverOpen] = useState(false)
  const [newTagName, setNewTagName] = useState('')
  const [creatingTag, setCreatingTag] = useState(false)

  // Validation state
  const [emailError, setEmailError] = useState('')
  const [formError, setFormError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Fetch tags when sheet opens
  useEffect(() => {
    if (open && workspace) {
      fetchTags()
    }
  }, [open, workspace]) // eslint-disable-line react-hooks/exhaustive-deps

  const fetchTags = useCallback(async () => {
    try {
      const res = await fetch('/api/tags')
      if (res.ok) {
        const data = await res.json()
        setTags(data)
      }
    } catch {
      // Silently fail - tags are optional
    }
  }, [])

  const resetForm = () => {
    setFirstName('')
    setLastName('')
    setEmail('')
    setPhone('')
    setSource('manual')
    setSelectedTagIds([])
    setCustomFields([])
    setEmailError('')
    setFormError('')
  }

  const handleClose = (isOpen: boolean) => {
    if (!isOpen) {
      resetForm()
    }
    onOpenChange(isOpen)
  }

  const validateEmail = (value: string) => {
    if (value && !EMAIL_REGEX.test(value)) {
      setEmailError('Please enter a valid email address')
    } else {
      setEmailError('')
    }
  }

  const formatPhoneInput = (value: string) => {
    // Strip non-digit characters except +
    let cleaned = value.replace(/[^\d+]/g, '')

    // Auto-add +1 prefix for 10-digit US numbers without prefix
    if (cleaned.length === 10 && !cleaned.startsWith('+')) {
      cleaned = '+1' + cleaned
    } else if (cleaned.length > 0 && !cleaned.startsWith('+')) {
      cleaned = '+1' + cleaned
    }

    setPhone(cleaned)
  }

  const toggleTag = (tagId: string) => {
    setSelectedTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    )
  }

  const createTag = async () => {
    if (!newTagName.trim()) return

    setCreatingTag(true)
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
        setSelectedTagIds((prev) => [...prev, tag.id])
        setNewTagName('')
      }
    } catch {
      // Silently fail
    } finally {
      setCreatingTag(false)
    }
  }

  const addCustomField = () => {
    setCustomFields((prev) => [...prev, { key: '', value: '' }])
  }

  const updateCustomField = (index: number, field: 'key' | 'value', value: string) => {
    setCustomFields((prev) => {
      const updated = [...prev]
      updated[index] = { ...updated[index], [field]: value }
      return updated
    })
  }

  const removeCustomField = (index: number) => {
    setCustomFields((prev) => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = async () => {
    // Validate
    setFormError('')

    if (!email && !phone) {
      setFormError('At least one of email or phone is required')
      return
    }

    if (email && !EMAIL_REGEX.test(email)) {
      setEmailError('Please enter a valid email address')
      return
    }

    setIsSubmitting(true)

    try {
      // Build custom_fields object from key-value pairs
      const customFieldsObj: Record<string, string> = {}
      for (const cf of customFields) {
        if (cf.key.trim()) {
          customFieldsObj[cf.key.trim()] = cf.value
        }
      }

      const payload = {
        first_name: firstName || undefined,
        last_name: lastName || undefined,
        email: email || undefined,
        phone: phone || undefined,
        source,
        tag_ids: selectedTagIds.length > 0 ? selectedTagIds : undefined,
        custom_fields: Object.keys(customFieldsObj).length > 0 ? customFieldsObj : undefined,
      }

      const res = await fetch('/api/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const data = await res.json()
        setFormError(data.error || 'Failed to create contact')
        return
      }

      onSuccess()

      if (addAnother) {
        resetForm()
      } else {
        handleClose(false)
      }
    } catch {
      setFormError('An unexpected error occurred')
    } finally {
      setIsSubmitting(false)
    }
  }

  const selectedTags = tags.filter((t) => selectedTagIds.includes(t.id))

  return (
    <Sheet open={open} onOpenChange={handleClose}>
      <SheetContent className="sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Add Contact</SheetTitle>
          <SheetDescription>
            Create a new contact. At least an email or phone number is required.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          {/* First Name */}
          <div className="space-y-2">
            <Label htmlFor="firstName">First Name</Label>
            <Input
              id="firstName"
              placeholder="John"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
            />
          </div>

          {/* Last Name */}
          <div className="space-y-2">
            <Label htmlFor="lastName">Last Name</Label>
            <Input
              id="lastName"
              placeholder="Doe"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
            />
          </div>

          {/* Email */}
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="john@example.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value)
                if (emailError) setEmailError('')
              }}
              onBlur={() => validateEmail(email)}
              className={emailError ? 'border-destructive' : ''}
            />
            {emailError && (
              <p className="text-xs text-destructive">{emailError}</p>
            )}
          </div>

          {/* Phone */}
          <div className="space-y-2">
            <Label htmlFor="phone">Phone</Label>
            <Input
              id="phone"
              placeholder="+1 (555) 123-4567"
              value={phone}
              onChange={(e) => formatPhoneInput(e.target.value)}
            />
          </div>

          {/* Source */}
          <div className="space-y-2">
            <Label>Source</Label>
            <Select value={source} onValueChange={setSource}>
              <SelectTrigger>
                <SelectValue placeholder="Select source" />
              </SelectTrigger>
              <SelectContent>
                {SOURCES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Tags */}
          <div className="space-y-2">
            <Label>Tags</Label>
            <Popover open={tagPopoverOpen} onOpenChange={setTagPopoverOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={tagPopoverOpen}
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
                          placeholder="New tag name..."
                          value={newTagName}
                          onChange={(e) => setNewTagName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault()
                              createTag()
                            }
                          }}
                          className="h-8 text-sm"
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={createTag}
                          disabled={!newTagName.trim() || creatingTag}
                          className="h-8 shrink-0"
                        >
                          {creatingTag ? (
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
                      onClick={() => toggleTag(tag.id)}
                      className="ml-0.5 rounded-full hover:bg-muted"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Custom Fields */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Custom Fields</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={addCustomField}
                className="h-7 text-xs"
              >
                <Plus className="mr-1 h-3 w-3" />
                Add field
              </Button>
            </div>

            {customFields.length > 0 && (
              <ScrollArea className={customFields.length > 3 ? 'h-40' : ''}>
                <div className="space-y-2">
                  {customFields.map((cf, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <Input
                        placeholder="Field name"
                        value={cf.key}
                        onChange={(e) => updateCustomField(index, 'key', e.target.value)}
                        className="h-8 text-sm"
                      />
                      <Input
                        placeholder="Value"
                        value={cf.value}
                        onChange={(e) => updateCustomField(index, 'value', e.target.value)}
                        className="h-8 text-sm"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeCustomField(index)}
                        className="h-8 w-8 shrink-0 p-0"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>

          {/* Error message */}
          {formError && (
            <p className="text-sm text-destructive">{formError}</p>
          )}
        </div>

        <SheetFooter className="mt-6">
          <div className="flex w-full items-center justify-between">
            <div className="flex items-center gap-2">
              <Checkbox
                id="addAnother"
                checked={addAnother}
                onCheckedChange={(checked) => setAddAnother(checked === true)}
              />
              <Label htmlFor="addAnother" className="text-sm font-normal cursor-pointer">
                Add another
              </Label>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => handleClose(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Add Contact
              </Button>
            </div>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
