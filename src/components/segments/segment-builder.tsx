'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useWorkspace } from '@/lib/hooks/use-workspace'
import type { Segment, FilterCondition, FilterRules, Tag } from '@/lib/types'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

import { Loader2, Plus, X, Users } from 'lucide-react'

// ---------------------------------------------------------------
// Field / Operator / Value configuration
// ---------------------------------------------------------------

interface FieldConfig {
  value: string
  label: string
  type: 'text' | 'number' | 'date' | 'list' | 'tag'
  options?: { value: string; label: string }[]
}

const FIELDS: FieldConfig[] = [
  { value: 'tag', label: 'Tag', type: 'tag' },
  {
    value: 'email_status',
    label: 'Email Status',
    type: 'list',
    options: [
      { value: 'active', label: 'Active' },
      { value: 'unsubscribed', label: 'Unsubscribed' },
      { value: 'bounced', label: 'Bounced' },
      { value: 'complained', label: 'Complained' },
    ],
  },
  {
    value: 'sms_status',
    label: 'SMS Status',
    type: 'list',
    options: [
      { value: 'active', label: 'Active' },
      { value: 'unsubscribed', label: 'Unsubscribed' },
      { value: 'stopped', label: 'Stopped' },
    ],
  },
  {
    value: 'status',
    label: 'Status',
    type: 'list',
    options: [
      { value: 'active', label: 'Active' },
      { value: 'unsubscribed', label: 'Unsubscribed' },
      { value: 'bounced', label: 'Bounced' },
      { value: 'complained', label: 'Complained' },
      { value: 'inactive', label: 'Inactive' },
    ],
  },
  { value: 'created_at', label: 'Created Date', type: 'date' },
  { value: 'last_contacted_at', label: 'Last Contacted', type: 'date' },
  { value: 'last_opened_at', label: 'Last Opened', type: 'date' },
  { value: 'lead_score', label: 'Lead Score', type: 'number' },
  { value: 'source', label: 'Source', type: 'text' },
  { value: 'email', label: 'Email', type: 'text' },
  { value: 'first_name', label: 'First Name', type: 'text' },
  { value: 'last_name', label: 'Last Name', type: 'text' },
  { value: 'phone', label: 'Phone', type: 'text' },
]

const OPERATORS_BY_TYPE: Record<string, { value: FilterCondition['operator']; label: string }[]> = {
  text: [
    { value: 'equals', label: 'equals' },
    { value: 'not_equals', label: 'not equals' },
    { value: 'contains', label: 'contains' },
    { value: 'not_contains', label: 'not contains' },
    { value: 'starts_with', label: 'starts with' },
    { value: 'is_empty', label: 'is empty' },
    { value: 'is_not_empty', label: 'is not empty' },
  ],
  number: [
    { value: 'equals', label: 'equals' },
    { value: 'not_equals', label: 'not equals' },
    { value: 'greater_than', label: 'greater than' },
    { value: 'less_than', label: 'less than' },
  ],
  date: [
    { value: 'greater_than', label: 'after' },
    { value: 'less_than', label: 'before' },
    { value: 'is_empty', label: 'is empty' },
    { value: 'is_not_empty', label: 'is not empty' },
  ],
  list: [
    { value: 'equals', label: 'equals' },
    { value: 'not_equals', label: 'not equals' },
    { value: 'in_list', label: 'in list' },
  ],
  tag: [
    { value: 'equals', label: 'equals' },
    { value: 'not_equals', label: 'not equals' },
    { value: 'in_list', label: 'in list' },
  ],
}

// ---------------------------------------------------------------
// Props
// ---------------------------------------------------------------

interface SegmentBuilderProps {
  segment?: Segment
  onSave: (segment: Segment) => void
  onCancel: () => void
}

// ---------------------------------------------------------------
// Component
// ---------------------------------------------------------------

export function SegmentBuilder({ segment, onSave, onCancel }: SegmentBuilderProps) {
  const { workspace } = useWorkspace()

  // Form state
  const [name, setName] = useState(segment?.name || '')
  const [description, setDescription] = useState(segment?.description || '')
  const [isDynamic, setIsDynamic] = useState(segment?.is_dynamic ?? true)
  const [logicOperator, setLogicOperator] = useState<'AND' | 'OR'>(
    segment?.filter_rules?.operator || 'AND'
  )
  const [conditions, setConditions] = useState<FilterCondition[]>(
    segment?.filter_rules?.conditions?.length
      ? segment.filter_rules.conditions
      : [{ field: '', operator: 'equals', value: '' }]
  )

  // Preview state
  const [previewCount, setPreviewCount] = useState<number | null>(null)
  const [isPreviewLoading, setIsPreviewLoading] = useState(false)
  const previewTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Tags for tag field
  const [tags, setTags] = useState<Tag[]>([])

  // Save state
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')

  // ---------------------------------------------------------------
  // Fetch tags
  // ---------------------------------------------------------------
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

  // ---------------------------------------------------------------
  // Preview count with debounce
  // ---------------------------------------------------------------
  const fetchPreview = useCallback(async (rules: FilterRules) => {
    // Only preview if there is at least one complete condition
    const hasComplete = rules.conditions.some(
      (c) => c.field && c.operator
    )
    if (!hasComplete) {
      setPreviewCount(null)
      return
    }

    setIsPreviewLoading(true)
    try {
      const res = await fetch('/api/segments/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filter_rules: rules }),
      })
      if (res.ok) {
        const data = await res.json()
        setPreviewCount(data.count ?? data.contact_count ?? 0)
      }
    } catch {
      // silently fail
    } finally {
      setIsPreviewLoading(false)
    }
  }, [])

  useEffect(() => {
    if (previewTimer.current) {
      clearTimeout(previewTimer.current)
    }

    const rules: FilterRules = { operator: logicOperator, conditions }
    previewTimer.current = setTimeout(() => {
      fetchPreview(rules)
    }, 500)

    return () => {
      if (previewTimer.current) {
        clearTimeout(previewTimer.current)
      }
    }
  }, [conditions, logicOperator, fetchPreview])

  // ---------------------------------------------------------------
  // Condition helpers
  // ---------------------------------------------------------------
  const getFieldConfig = (fieldValue: string): FieldConfig | undefined =>
    FIELDS.find((f) => f.value === fieldValue)

  const getOperatorsForField = (fieldValue: string) => {
    const config = getFieldConfig(fieldValue)
    if (!config) return OPERATORS_BY_TYPE.text
    return OPERATORS_BY_TYPE[config.type] || OPERATORS_BY_TYPE.text
  }

  const isValueless = (operator: string) =>
    operator === 'is_empty' || operator === 'is_not_empty'

  const updateCondition = (index: number, updates: Partial<FilterCondition>) => {
    setConditions((prev) => {
      const next = [...prev]
      next[index] = { ...next[index], ...updates }

      // If field changed, reset operator and value
      if (updates.field !== undefined && updates.field !== prev[index].field) {
        const operators = getOperatorsForField(updates.field)
        next[index].operator = operators[0]?.value || 'equals'
        next[index].value = ''
      }

      // If operator changed to a valueless one, clear value
      if (updates.operator && isValueless(updates.operator)) {
        next[index].value = null
      }

      return next
    })
  }

  const addCondition = () => {
    setConditions((prev) => [...prev, { field: '', operator: 'equals', value: '' }])
  }

  const removeCondition = (index: number) => {
    if (conditions.length <= 1) return
    setConditions((prev) => prev.filter((_, i) => i !== index))
  }

  // ---------------------------------------------------------------
  // Save
  // ---------------------------------------------------------------
  const handleSave = async () => {
    setError('')

    if (!name.trim()) {
      setError('Segment name is required')
      return
    }

    const validConditions = conditions.filter((c) => c.field && c.operator)
    if (validConditions.length === 0) {
      setError('At least one complete condition is required')
      return
    }

    setIsSaving(true)
    try {
      const payload = {
        name: name.trim(),
        description: description.trim() || null,
        is_dynamic: isDynamic,
        filter_rules: {
          operator: logicOperator,
          conditions: validConditions,
        },
      }

      const url = segment ? `/api/segments/${segment.id}` : '/api/segments'
      const method = segment ? 'PATCH' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'Failed to save segment')
        return
      }

      const saved: Segment = await res.json()
      onSave(saved)
    } catch {
      setError('An unexpected error occurred')
    } finally {
      setIsSaving(false)
    }
  }

  // ---------------------------------------------------------------
  // Value input renderer
  // ---------------------------------------------------------------
  const renderValueInput = (condition: FilterCondition, index: number) => {
    if (isValueless(condition.operator)) {
      return null
    }

    const config = getFieldConfig(condition.field)
    if (!config) {
      return (
        <Input
          placeholder="Value"
          value={(condition.value as string) || ''}
          onChange={(e) => updateCondition(index, { value: e.target.value })}
          className="h-8 text-sm flex-1 min-w-[120px]"
        />
      )
    }

    switch (config.type) {
      case 'number':
        return (
          <Input
            type="number"
            placeholder="Value"
            value={(condition.value as string | number) ?? ''}
            onChange={(e) => updateCondition(index, { value: e.target.value ? Number(e.target.value) : '' })}
            className="h-8 text-sm flex-1 min-w-[120px]"
          />
        )

      case 'date':
        return (
          <Input
            type="date"
            value={(condition.value as string) || ''}
            onChange={(e) => updateCondition(index, { value: e.target.value })}
            className="h-8 text-sm flex-1 min-w-[120px]"
          />
        )

      case 'list':
        return (
          <Select
            value={(condition.value as string) || ''}
            onValueChange={(val) => updateCondition(index, { value: val })}
          >
            <SelectTrigger className="h-8 text-sm flex-1 min-w-[120px]">
              <SelectValue placeholder="Select..." />
            </SelectTrigger>
            <SelectContent>
              {config.options?.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )

      case 'tag':
        return (
          <Select
            value={(condition.value as string) || ''}
            onValueChange={(val) => updateCondition(index, { value: val })}
          >
            <SelectTrigger className="h-8 text-sm flex-1 min-w-[120px]">
              <SelectValue placeholder="Select tag..." />
            </SelectTrigger>
            <SelectContent>
              {tags.map((tag) => (
                <SelectItem key={tag.id} value={tag.id}>
                  <div className="flex items-center gap-2">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: tag.color }}
                    />
                    {tag.name}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )

      default:
        return (
          <Input
            placeholder="Value"
            value={(condition.value as string) || ''}
            onChange={(e) => updateCondition(index, { value: e.target.value })}
            className="h-8 text-sm flex-1 min-w-[120px]"
          />
        )
    }
  }

  // ---------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------
  return (
    <div className="space-y-6">
      {/* Name */}
      <div className="space-y-2">
        <Label htmlFor="segment-name">Segment Name</Label>
        <Input
          id="segment-name"
          placeholder="e.g. Active subscribers"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>

      {/* Description */}
      <div className="space-y-2">
        <Label htmlFor="segment-desc">Description (optional)</Label>
        <Textarea
          id="segment-desc"
          placeholder="Describe what this segment is for..."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
        />
      </div>

      {/* Dynamic toggle */}
      <div className="flex items-center justify-between rounded-md border p-3">
        <div className="space-y-0.5">
          <Label htmlFor="dynamic-toggle" className="cursor-pointer">
            Dynamic Segment
          </Label>
          <p className="text-xs text-muted-foreground">
            Automatically updates membership as contacts match rules
          </p>
        </div>
        <Switch
          id="dynamic-toggle"
          checked={isDynamic}
          onCheckedChange={setIsDynamic}
        />
      </div>

      {/* Rule builder */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>Conditions</Label>
          {/* AND/OR toggle */}
          <div className="flex rounded-md border">
            <button
              type="button"
              onClick={() => setLogicOperator('AND')}
              className={`px-3 py-1 text-xs font-medium transition-colors ${
                logicOperator === 'AND'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              } rounded-l-md`}
            >
              AND
            </button>
            <button
              type="button"
              onClick={() => setLogicOperator('OR')}
              className={`px-3 py-1 text-xs font-medium transition-colors ${
                logicOperator === 'OR'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              } rounded-r-md`}
            >
              OR
            </button>
          </div>
        </div>

        {/* Condition rows */}
        <div className="space-y-2">
          {conditions.map((condition, index) => (
            <div key={index} className="flex items-center gap-2 flex-wrap">
              {/* Connector label */}
              {index > 0 && (
                <span className="text-xs font-medium text-muted-foreground w-8 text-center shrink-0">
                  {logicOperator}
                </span>
              )}
              {index === 0 && conditions.length > 1 && (
                <span className="w-8 shrink-0" />
              )}

              {/* Field select */}
              <Select
                value={condition.field}
                onValueChange={(val) => updateCondition(index, { field: val })}
              >
                <SelectTrigger className="h-8 text-sm w-[150px]">
                  <SelectValue placeholder="Field..." />
                </SelectTrigger>
                <SelectContent>
                  {FIELDS.map((field) => (
                    <SelectItem key={field.value} value={field.value}>
                      {field.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Operator select */}
              <Select
                value={condition.operator}
                onValueChange={(val) =>
                  updateCondition(index, { operator: val as FilterCondition['operator'] })
                }
              >
                <SelectTrigger className="h-8 text-sm w-[140px]">
                  <SelectValue placeholder="Operator..." />
                </SelectTrigger>
                <SelectContent>
                  {getOperatorsForField(condition.field).map((op) => (
                    <SelectItem key={op.value} value={op.value}>
                      {op.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Value input */}
              {renderValueInput(condition, index)}

              {/* Remove button */}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => removeCondition(index)}
                disabled={conditions.length <= 1}
                className="h-8 w-8 shrink-0 p-0"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>

        {/* Add condition button */}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addCondition}
          className="h-8 text-xs"
        >
          <Plus className="mr-1 h-3 w-3" />
          Add condition
        </Button>
      </div>

      {/* Preview */}
      <div className="flex items-center gap-2 rounded-md border bg-muted/50 px-3 py-2">
        <Users className="h-4 w-4 text-muted-foreground" />
        {isPreviewLoading ? (
          <Skeleton className="h-4 w-32" />
        ) : previewCount !== null ? (
          <span className="text-sm">
            <strong>{previewCount}</strong> contact{previewCount !== 1 ? 's' : ''} match
          </span>
        ) : (
          <span className="text-sm text-muted-foreground">
            Add conditions to preview matching contacts
          </span>
        )}
      </div>

      {/* Error */}
      {error && <p className="text-sm text-destructive">{error}</p>}

      {/* Action buttons */}
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onCancel} disabled={isSaving}>
          Cancel
        </Button>
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {segment ? 'Update Segment' : 'Create Segment'}
        </Button>
      </div>
    </div>
  )
}
