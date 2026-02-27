'use client'

import { useRef, useCallback, useMemo } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Monitor, Smartphone } from 'lucide-react'
import { useState } from 'react'
import { replaceMergeTags } from '@/lib/utils/merge-tags'

interface EmailEditorProps {
  subject: string
  onSubjectChange: (subject: string) => void
  previewText: string
  onPreviewTextChange: (text: string) => void
  htmlBody: string
  onHtmlBodyChange: (html: string) => void
  showSubject?: boolean
}

const MERGE_TAGS = [
  { label: 'First Name', tag: '{{first_name}}' },
  { label: 'Last Name', tag: '{{last_name}}' },
  { label: 'Full Name', tag: '{{full_name}}' },
  { label: 'Email', tag: '{{email}}' },
  { label: 'Company', tag: '{{company_name}}' },
  { label: 'Unsubscribe', tag: '{{unsubscribe_url}}' },
]

const SAMPLE_DATA = {
  first_name: 'Jane',
  last_name: 'Doe',
  full_name: 'Jane Doe',
  email: 'jane@example.com',
  company_name: 'Acme Inc',
}

export function EmailEditor({
  subject,
  onSubjectChange,
  previewText,
  onPreviewTextChange,
  htmlBody,
  onHtmlBodyChange,
  showSubject = true,
}: EmailEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [previewWidth, setPreviewWidth] = useState<'desktop' | 'mobile'>('desktop')

  const insertMergeTag = useCallback(
    (tag: string) => {
      const textarea = textareaRef.current
      if (!textarea) return

      const start = textarea.selectionStart
      const end = textarea.selectionEnd
      const before = htmlBody.slice(0, start)
      const after = htmlBody.slice(end)
      const newValue = before + tag + after

      onHtmlBodyChange(newValue)

      // Restore cursor position after the inserted tag
      requestAnimationFrame(() => {
        textarea.focus()
        const cursorPos = start + tag.length
        textarea.setSelectionRange(cursorPos, cursorPos)
      })
    },
    [htmlBody, onHtmlBodyChange]
  )

  const previewHtml = useMemo(() => {
    return replaceMergeTags(htmlBody, SAMPLE_DATA, { unsubscribe_url: '#' })
  }, [htmlBody])

  const iframeWidth = previewWidth === 'desktop' ? 600 : 320

  return (
    <div className="space-y-4">
      {showSubject && (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="email-subject">Subject</Label>
            <Input
              id="email-subject"
              placeholder="Enter email subject..."
              value={subject}
              onChange={(e) => onSubjectChange(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email-preview-text">Preview Text</Label>
            <Input
              id="email-preview-text"
              placeholder="Brief summary shown in inbox..."
              value={previewText}
              onChange={(e) => onPreviewTextChange(e.target.value)}
            />
          </div>
        </div>
      )}

      {/* Merge Tag Toolbar */}
      <div className="space-y-1.5">
        <Label>Insert Merge Tags</Label>
        <div className="flex flex-wrap gap-1.5">
          {MERGE_TAGS.map((item) => (
            <Button
              key={item.tag}
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={() => insertMergeTag(item.tag)}
            >
              {item.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Split Layout: Editor + Preview */}
      <div className="flex gap-4">
        {/* Left Panel - Editor (60%) */}
        <div className="w-[60%] space-y-1.5">
          <Label htmlFor="html-editor">HTML Body</Label>
          <textarea
            ref={textareaRef}
            id="html-editor"
            className="w-full min-h-[500px] rounded-md border border-input bg-background px-3 py-2 text-sm font-mono ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-y"
            placeholder="Enter your HTML email body..."
            value={htmlBody}
            onChange={(e) => onHtmlBodyChange(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            {htmlBody.length.toLocaleString()} characters
          </p>
        </div>

        {/* Right Panel - Preview (40%) */}
        <div className="w-[40%] space-y-1.5">
          <div className="flex items-center justify-between">
            <Label>Preview</Label>
            <div className="flex gap-1">
              <Button
                type="button"
                variant={previewWidth === 'desktop' ? 'default' : 'outline'}
                size="sm"
                className="h-7"
                onClick={() => setPreviewWidth('desktop')}
              >
                <Monitor className="mr-1 h-3 w-3" />
                Desktop
              </Button>
              <Button
                type="button"
                variant={previewWidth === 'mobile' ? 'default' : 'outline'}
                size="sm"
                className="h-7"
                onClick={() => setPreviewWidth('mobile')}
              >
                <Smartphone className="mr-1 h-3 w-3" />
                Mobile
              </Button>
            </div>
          </div>
          <div className="min-h-[500px] rounded-md border bg-muted/30 overflow-auto flex justify-center p-4">
            <div style={{ width: iframeWidth, maxWidth: '100%' }}>
              <iframe
                title="Email Preview"
                srcDoc={previewHtml}
                className="w-full min-h-[480px] rounded border bg-white"
                sandbox="allow-same-origin"
                style={{ width: iframeWidth, maxWidth: '100%' }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
