'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import { useWorkspace } from '@/lib/hooks/use-workspace'
import { parseCSV } from '@/lib/utils/csv-parser'
import { MAX_CSV_ROWS, TAG_COLORS } from '@/lib/constants'
import type { Tag } from '@/lib/types'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Progress } from '@/components/ui/progress'
import {
  Card,
  CardContent,
  CardHeader,
} from '@/components/ui/card'
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
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'

import {
  Upload,
  FileText,
  Check,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Download,
  X,
  Plus,
  Loader2,
} from 'lucide-react'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BLASTOFF_FIELDS = [
  { value: 'first_name', label: 'First Name' },
  { value: 'last_name', label: 'Last Name' },
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Phone' },
  { value: 'source', label: 'Source' },
] as const

const SKIP_VALUE = '__skip__'

/** Lowercase CSV header -> blastoff field mapping for auto-detect */
const AUTO_MAP: Record<string, string> = {
  first_name: 'first_name',
  'first name': 'first_name',
  firstname: 'first_name',
  'given name': 'first_name',
  last_name: 'last_name',
  'last name': 'last_name',
  lastname: 'last_name',
  surname: 'last_name',
  'family name': 'last_name',
  email: 'email',
  'email address': 'email',
  'e-mail': 'email',
  phone: 'phone',
  'phone number': 'phone',
  mobile: 'phone',
  cell: 'phone',
  telephone: 'phone',
  source: 'source',
  origin: 'source',
  channel: 'source',
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ImportResults {
  imported: number
  updated: number
  skipped: number
  errors: { row: number; error: string }[]
}

// ---------------------------------------------------------------------------
// Step Indicator
// ---------------------------------------------------------------------------

function StepIndicator({ currentStep }: { currentStep: number }) {
  const steps = [
    { num: 1, label: 'Upload' },
    { num: 2, label: 'Map Columns' },
    { num: 3, label: 'Options' },
    { num: 4, label: 'Import' },
  ]

  return (
    <div className="flex items-center justify-center gap-0 px-8 py-4">
      {steps.map((s, idx) => (
        <div key={s.num} className="flex items-center">
          {/* Circle */}
          <div className="flex flex-col items-center">
            <div
              className={`flex h-9 w-9 items-center justify-center rounded-full border-2 text-sm font-semibold transition-colors ${
                s.num < currentStep
                  ? 'border-primary bg-primary text-primary-foreground'
                  : s.num === currentStep
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-muted-foreground/30 bg-background text-muted-foreground'
              }`}
            >
              {s.num < currentStep ? (
                <Check className="h-4 w-4" />
              ) : (
                s.num
              )}
            </div>
            <span
              className={`mt-1.5 text-xs font-medium ${
                s.num <= currentStep
                  ? 'text-foreground'
                  : 'text-muted-foreground'
              }`}
            >
              {s.label}
            </span>
          </div>
          {/* Connector line */}
          {idx < steps.length - 1 && (
            <div
              className={`mx-2 mb-5 h-0.5 w-16 sm:w-24 ${
                s.num < currentStep ? 'bg-primary' : 'bg-muted-foreground/30'
              }`}
            />
          )}
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page Component
// ---------------------------------------------------------------------------

export default function ImportContactsPage() {
  const { workspace } = useWorkspace()

  // Wizard state
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1)
  const [file, setFile] = useState<File | null>(null)
  const [csvData, setCsvData] = useState<Record<string, string>[]>([])
  const [csvHeaders, setCsvHeaders] = useState<string[]>([])
  const [parseError, setParseError] = useState<string | null>(null)

  // Step 2 - mapping
  const [mapping, setMapping] = useState<Record<string, string>>({})

  // Step 3 - options
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([])
  const [availableTags, setAvailableTags] = useState<Tag[]>([])
  const [duplicateHandling, setDuplicateHandling] = useState<'skip' | 'update'>('skip')
  const [newTagName, setNewTagName] = useState('')
  const [isCreatingTag, setIsCreatingTag] = useState(false)

  // Step 4 - processing
  const [isProcessing, setIsProcessing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [results, setResults] = useState<ImportResults | null>(null)
  const [importError, setImportError] = useState<string | null>(null)

  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ------------------------------------------------------------------
  // Computed
  // ------------------------------------------------------------------
  const emailMapped = Object.values(mapping).includes('email')
  const phoneMapped = Object.values(mapping).includes('phone')
  const hasRequiredMapping = emailMapped || phoneMapped

  // ------------------------------------------------------------------
  // File handling
  // ------------------------------------------------------------------
  const handleFile = useCallback(async (f: File) => {
    setParseError(null)

    if (!f.name.endsWith('.csv') && !f.name.endsWith('.txt')) {
      setParseError('Please upload a .csv or .txt file.')
      return
    }

    try {
      const result = await parseCSV(f)

      if (result.data.length === 0) {
        setParseError('The file contains no data rows.')
        return
      }

      if (result.data.length > MAX_CSV_ROWS) {
        setParseError(
          `File contains ${result.data.length.toLocaleString()} rows, which exceeds the maximum of ${MAX_CSV_ROWS.toLocaleString()}.`
        )
        return
      }

      setFile(f)
      setCsvData(result.data)
      setCsvHeaders(result.headers)

      // Auto-map columns
      const autoMapping: Record<string, string> = {}
      for (const header of result.headers) {
        const normalized = header.toLowerCase().trim()
        if (AUTO_MAP[normalized]) {
          // Ensure we don't map two CSV columns to the same blastoff field
          const alreadyMapped = Object.values(autoMapping).includes(AUTO_MAP[normalized])
          if (!alreadyMapped) {
            autoMapping[header] = AUTO_MAP[normalized]
          }
        }
      }
      setMapping(autoMapping)
    } catch {
      setParseError('Failed to parse the file. Please check the format and try again.')
    }
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      e.stopPropagation()
      const droppedFile = e.dataTransfer.files[0]
      if (droppedFile) handleFile(droppedFile)
    },
    [handleFile]
  )

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selected = e.target.files?.[0]
      if (selected) handleFile(selected)
    },
    [handleFile]
  )

  const clearFile = () => {
    setFile(null)
    setCsvData([])
    setCsvHeaders([])
    setMapping({})
    setParseError(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  // ------------------------------------------------------------------
  // Mapping
  // ------------------------------------------------------------------
  const updateMapping = (csvHeader: string, blastoffField: string) => {
    setMapping((prev) => {
      const next = { ...prev }
      if (blastoffField === SKIP_VALUE) {
        delete next[csvHeader]
      } else {
        // Remove any existing mapping to this blastoff field (one-to-one)
        for (const key of Object.keys(next)) {
          if (next[key] === blastoffField) {
            delete next[key]
          }
        }
        next[csvHeader] = blastoffField
      }
      return next
    })
  }

  const getSampleValues = (header: string): string[] => {
    return csvData
      .slice(0, 3)
      .map((row) => row[header] || '')
      .filter(Boolean)
  }

  // ------------------------------------------------------------------
  // Tags
  // ------------------------------------------------------------------
  useEffect(() => {
    if (!workspace) return
    const loadTags = async () => {
      try {
        const res = await fetch('/api/tags')
        if (res.ok) {
          const data = await res.json()
          setAvailableTags(data)
        }
      } catch {
        // silently fail
      }
    }
    loadTags()
  }, [workspace])

  const toggleTag = (tagId: string) => {
    setSelectedTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    )
  }

  const handleCreateTag = async () => {
    if (!newTagName.trim() || isCreatingTag) return
    setIsCreatingTag(true)
    try {
      const color = TAG_COLORS[Math.floor(Math.random() * TAG_COLORS.length)]
      const res = await fetch('/api/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newTagName.trim(), color }),
      })
      if (res.ok) {
        const tag: Tag = await res.json()
        setAvailableTags((prev) => [...prev, tag])
        setSelectedTagIds((prev) => [...prev, tag.id])
        setNewTagName('')
      }
    } catch {
      // silently fail
    } finally {
      setIsCreatingTag(false)
    }
  }

  // ------------------------------------------------------------------
  // Import
  // ------------------------------------------------------------------
  const runImport = useCallback(async () => {
    setIsProcessing(true)
    setProgress(0)
    setResults(null)
    setImportError(null)

    // Build contact objects from CSV data using the mapping
    const reverseMapping: Record<string, string> = {}
    for (const [csvCol, field] of Object.entries(mapping)) {
      reverseMapping[field] = csvCol
    }

    const contacts = csvData.map((row) => {
      const contact: Record<string, string> = {}
      for (const field of BLASTOFF_FIELDS) {
        const csvCol = reverseMapping[field.value]
        if (csvCol && row[csvCol]) {
          contact[field.value] = row[csvCol].trim()
        }
      }
      return contact
    })

    // Simulate progress while waiting for the API
    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 90) {
          clearInterval(progressInterval)
          return 90
        }
        // Ease-out curve: slows down as it approaches 90
        const increment = Math.max(1, Math.floor((90 - prev) / 10))
        return Math.min(90, prev + increment)
      })
    }, 300)

    try {
      const res = await fetch('/api/contacts/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contacts,
          tag_ids: selectedTagIds,
          duplicate_handling: duplicateHandling,
        }),
      })

      clearInterval(progressInterval)

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData.error || `Import failed with status ${res.status}`)
      }

      const data: ImportResults = await res.json()
      setProgress(100)
      setResults(data)
    } catch (err) {
      clearInterval(progressInterval)
      setProgress(0)
      setImportError(err instanceof Error ? err.message : 'An unexpected error occurred.')
    } finally {
      setIsProcessing(false)
    }
  }, [csvData, mapping, selectedTagIds, duplicateHandling])

  // Trigger import on step 4 mount
  useEffect(() => {
    if (step === 4 && !results && !isProcessing && !importError) {
      runImport()
    }
  }, [step, results, isProcessing, importError, runImport])

  // ------------------------------------------------------------------
  // Error report download
  // ------------------------------------------------------------------
  const downloadErrorReport = () => {
    if (!results?.errors.length) return

    const csvContent = [
      'Row,Error',
      ...results.errors.map(
        (e) => `${e.row},"${e.error.replace(/"/g, '""')}"`
      ),
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'import-errors.csv'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  // ------------------------------------------------------------------
  // Navigation
  // ------------------------------------------------------------------
  const canGoNext = (): boolean => {
    switch (step) {
      case 1:
        return file !== null && csvData.length > 0 && !parseError
      case 2:
        return hasRequiredMapping
      case 3:
        return true
      default:
        return false
    }
  }

  const goNext = () => {
    if (step === 3) {
      setStep(4)
    } else if (step < 3) {
      setStep((step + 1) as 1 | 2 | 3 | 4)
    }
  }

  const goBack = () => {
    if (step > 1) {
      // If going back from step 4, reset processing state
      if (step === 4) {
        setResults(null)
        setProgress(0)
        setImportError(null)
        setIsProcessing(false)
      }
      setStep((step - 1) as 1 | 2 | 3 | 4)
    }
  }

  // ------------------------------------------------------------------
  // Render: Step 1 - Upload
  // ------------------------------------------------------------------
  const renderStep1 = () => (
    <div className="space-y-6">
      {/* Drag-and-drop zone */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/25 bg-muted/50 px-6 py-16 text-center transition-colors hover:border-muted-foreground/50 hover:bg-muted/80"
      >
        <Upload className="h-10 w-10 text-muted-foreground/50" />
        <p className="mt-4 text-sm font-medium">
          Drag and drop your CSV file here
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Supports .csv and .txt files up to {MAX_CSV_ROWS.toLocaleString()} rows
        </p>
        <Button
          variant="outline"
          size="sm"
          className="mt-4"
          onClick={() => fileInputRef.current?.click()}
        >
          Browse files
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.txt"
          onChange={handleFileInput}
          className="hidden"
        />
      </div>

      {/* Parse error */}
      {parseError && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{parseError}</AlertDescription>
        </Alert>
      )}

      {/* File info + Preview */}
      {file && csvData.length > 0 && !parseError && (
        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border bg-muted/30 p-4">
            <div className="flex items-center gap-3">
              <FileText className="h-8 w-8 text-primary" />
              <div>
                <p className="text-sm font-medium">{file.name}</p>
                <p className="text-xs text-muted-foreground">
                  {csvData.length.toLocaleString()} rows &middot;{' '}
                  {csvHeaders.length} columns
                </p>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={clearFile}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Preview table */}
          <div>
            <p className="mb-2 text-sm font-medium text-muted-foreground">
              Preview (first 5 rows)
            </p>
            <ScrollArea className="w-full rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    {csvHeaders.map((header) => (
                      <TableHead key={header} className="whitespace-nowrap">
                        {header}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {csvData.slice(0, 5).map((row, i) => (
                    <TableRow key={i}>
                      {csvHeaders.map((header) => (
                        <TableCell
                          key={header}
                          className="max-w-[200px] truncate whitespace-nowrap"
                        >
                          {row[header] || ''}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
          </div>
        </div>
      )}
    </div>
  )

  // ------------------------------------------------------------------
  // Render: Step 2 - Column Mapping
  // ------------------------------------------------------------------
  const renderStep2 = () => (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">
          Map your CSV columns to Blastoff contact fields. At least Email or Phone must be mapped.
        </p>
      </div>

      {/* Validation message */}
      {!hasRequiredMapping && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Required mapping</AlertTitle>
          <AlertDescription>
            At least Email or Phone must be mapped to proceed.
          </AlertDescription>
        </Alert>
      )}

      <div className="space-y-3">
        {csvHeaders.map((header) => {
          const currentValue = mapping[header] || SKIP_VALUE
          const samples = getSampleValues(header)
          const isMappedToRequired =
            mapping[header] === 'email' || mapping[header] === 'phone'

          return (
            <div
              key={header}
              className="flex items-center gap-4 rounded-lg border bg-background p-4"
            >
              {/* CSV column info */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium">{header}</p>
                  {isMappedToRequired && (
                    <Check className="h-4 w-4 text-green-600" />
                  )}
                </div>
                {samples.length > 0 && (
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {samples.join(', ')}
                  </p>
                )}
              </div>

              {/* Arrow */}
              <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />

              {/* Field selector */}
              <div className="w-[180px] shrink-0">
                <Select
                  value={currentValue}
                  onValueChange={(val) => updateMapping(header, val)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={SKIP_VALUE}>-- Skip --</SelectItem>
                    {BLASTOFF_FIELDS.map((field) => (
                      <SelectItem key={field.value} value={field.value}>
                        {field.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )

  // ------------------------------------------------------------------
  // Render: Step 3 - Options
  // ------------------------------------------------------------------
  const renderStep3 = () => (
    <div className="space-y-6">
      {/* Tag selection */}
      <div className="space-y-3">
        <Label className="text-sm font-medium">Tag imported contacts</Label>
        <p className="text-xs text-muted-foreground">
          Optionally tag all imported contacts for easy filtering later.
        </p>

        <div className="rounded-lg border p-4">
          {availableTags.length === 0 && !newTagName && (
            <p className="text-sm text-muted-foreground">
              No tags yet. Create one below.
            </p>
          )}

          <div className="space-y-2">
            {availableTags.map((tag) => (
              <div key={tag.id} className="flex items-center gap-3">
                <Checkbox
                  id={`tag-${tag.id}`}
                  checked={selectedTagIds.includes(tag.id)}
                  onCheckedChange={() => toggleTag(tag.id)}
                />
                <div
                  className="h-3 w-3 rounded-full"
                  style={{ backgroundColor: tag.color }}
                />
                <Label
                  htmlFor={`tag-${tag.id}`}
                  className="cursor-pointer text-sm font-normal"
                >
                  {tag.name}
                </Label>
              </div>
            ))}
          </div>

          <Separator className="my-3" />

          {/* Create new tag */}
          <div className="flex items-center gap-2">
            <Input
              placeholder="Create new tag..."
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  handleCreateTag()
                }
              }}
              className="h-8 flex-1"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={handleCreateTag}
              disabled={!newTagName.trim() || isCreatingTag}
              className="h-8"
            >
              {isCreatingTag ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Plus className="h-3 w-3" />
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Duplicate handling */}
      <div className="space-y-3">
        <Label className="text-sm font-medium">Duplicate handling</Label>
        <p className="text-xs text-muted-foreground">
          Choose what happens when a contact with a matching email or phone already exists.
        </p>

        <div className="space-y-2">
          <label
            className={`flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors ${
              duplicateHandling === 'skip'
                ? 'border-primary bg-primary/5'
                : 'hover:bg-muted/50'
            }`}
          >
            <input
              type="radio"
              name="duplicateHandling"
              value="skip"
              checked={duplicateHandling === 'skip'}
              onChange={() => setDuplicateHandling('skip')}
              className="mt-0.5"
            />
            <div>
              <p className="text-sm font-medium">Skip duplicates</p>
              <p className="text-xs text-muted-foreground">
                Contacts with a matching email or phone will not be imported.
              </p>
            </div>
          </label>

          <label
            className={`flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors ${
              duplicateHandling === 'update'
                ? 'border-primary bg-primary/5'
                : 'hover:bg-muted/50'
            }`}
          >
            <input
              type="radio"
              name="duplicateHandling"
              value="update"
              checked={duplicateHandling === 'update'}
              onChange={() => setDuplicateHandling('update')}
              className="mt-0.5"
            />
            <div>
              <p className="text-sm font-medium">Update existing</p>
              <p className="text-xs text-muted-foreground">
                Existing contacts will be updated with new data. Unsubscribed contacts will never be changed back to active.
              </p>
            </div>
          </label>
        </div>
      </div>

      {/* Summary */}
      <div className="rounded-lg border bg-muted/30 p-4">
        <p className="text-sm font-medium">
          Ready to import{' '}
          <span className="text-primary">
            {csvData.length.toLocaleString()}
          </span>{' '}
          contacts
        </p>
        <div className="mt-2 space-y-1 text-xs text-muted-foreground">
          <p>
            Mapped fields:{' '}
            {Object.values(mapping)
              .map((f) => BLASTOFF_FIELDS.find((bf) => bf.value === f)?.label)
              .filter(Boolean)
              .join(', ') || 'None'}
          </p>
          {selectedTagIds.length > 0 && (
            <p>
              Tags:{' '}
              {selectedTagIds
                .map((id) => availableTags.find((t) => t.id === id)?.name)
                .filter(Boolean)
                .join(', ')}
            </p>
          )}
          <p>
            Duplicates:{' '}
            {duplicateHandling === 'skip' ? 'Will be skipped' : 'Will be updated'}
          </p>
        </div>
      </div>
    </div>
  )

  // ------------------------------------------------------------------
  // Render: Step 4 - Processing + Results
  // ------------------------------------------------------------------
  const renderStep4 = () => (
    <div className="space-y-6">
      {/* Processing state */}
      {isProcessing && (
        <div className="flex flex-col items-center justify-center py-12">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="mt-4 text-sm font-medium">Importing contacts...</p>
          <p className="mt-1 text-xs text-muted-foreground">
            This may take a moment for large files.
          </p>
          <div className="mt-6 w-full max-w-sm">
            <Progress value={progress} />
            <p className="mt-2 text-center text-xs text-muted-foreground">
              {progress}%
            </p>
          </div>
        </div>
      )}

      {/* Import error */}
      {importError && !isProcessing && (
        <div className="space-y-4">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Import failed</AlertTitle>
            <AlertDescription>{importError}</AlertDescription>
          </Alert>
          <div className="flex justify-center gap-3">
            <Button variant="outline" onClick={goBack}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Go Back
            </Button>
            <Button
              onClick={() => {
                setImportError(null)
                runImport()
              }}
            >
              Retry Import
            </Button>
          </div>
        </div>
      )}

      {/* Results */}
      {results && !isProcessing && (
        <div className="space-y-4">
          {/* Success alert */}
          <Alert>
            <Check className="h-4 w-4" />
            <AlertTitle>Import complete</AlertTitle>
            <AlertDescription>
              {results.imported.toLocaleString()} imported
              {results.updated > 0 &&
                `, ${results.updated.toLocaleString()} updated`}
              {results.skipped > 0 &&
                `, ${results.skipped.toLocaleString()} skipped`}
            </AlertDescription>
          </Alert>

          {/* Stats grid */}
          <div className="grid grid-cols-3 gap-4">
            <div className="rounded-lg border p-4 text-center">
              <p className="text-2xl font-bold text-primary">
                {results.imported.toLocaleString()}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">Imported</p>
            </div>
            <div className="rounded-lg border p-4 text-center">
              <p className="text-2xl font-bold">
                {results.updated.toLocaleString()}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">Updated</p>
            </div>
            <div className="rounded-lg border p-4 text-center">
              <p className="text-2xl font-bold">
                {results.skipped.toLocaleString()}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">Skipped</p>
            </div>
          </div>

          {/* Errors */}
          {results.errors.length > 0 && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>
                {results.errors.length.toLocaleString()} error
                {results.errors.length !== 1 ? 's' : ''} occurred
              </AlertTitle>
              <AlertDescription className="mt-2">
                <p>Some rows could not be imported due to validation errors.</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={downloadErrorReport}
                >
                  <Download className="mr-2 h-3 w-3" />
                  Download error report
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {/* Go to Contacts button */}
          <div className="flex justify-center pt-2">
            <Button asChild>
              <Link href="/contacts">Go to Contacts</Link>
            </Button>
          </div>
        </div>
      )}
    </div>
  )

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Page header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/contacts">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Import Contacts</h1>
          <p className="text-sm text-muted-foreground">
            Upload a CSV file and map columns to import contacts.
          </p>
        </div>
      </div>

      {/* Wizard card */}
      <Card>
        <CardHeader className="pb-0">
          <StepIndicator currentStep={step} />
        </CardHeader>

        <Separator />

        <CardContent className="pt-6">
          {step === 1 && renderStep1()}
          {step === 2 && renderStep2()}
          {step === 3 && renderStep3()}
          {step === 4 && renderStep4()}
        </CardContent>

        {/* Navigation footer */}
        {step !== 4 && (
          <>
            <Separator />
            <div className="flex items-center justify-between px-6 py-4">
              <div>
                {step > 1 && (
                  <Button variant="outline" onClick={goBack}>
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back
                  </Button>
                )}
              </div>
              <div>
                {step < 3 && (
                  <Button onClick={goNext} disabled={!canGoNext()}>
                    Next
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                )}
                {step === 3 && (
                  <Button onClick={goNext} disabled={!canGoNext()}>
                    <Upload className="mr-2 h-4 w-4" />
                    Import
                  </Button>
                )}
              </div>
            </div>
          </>
        )}
      </Card>
    </div>
  )
}
