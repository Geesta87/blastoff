'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'

const TRIGGER_OPTIONS = [
  { value: 'contact_created', label: 'Contact Created' },
  { value: 'tag_added', label: 'Tag Added' },
  { value: 'tag_removed', label: 'Tag Removed' },
  { value: 'email_opened', label: 'Email Opened' },
  { value: 'email_clicked', label: 'Email Clicked' },
  { value: 'sms_delivered', label: 'SMS Delivered' },
  { value: 'webhook_received', label: 'Webhook Received' },
  { value: 'manual', label: 'Manual Enrollment' },
]

export default function NewAutomationPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [triggerType, setTriggerType] = useState('')
  const [allowReEntry, setAllowReEntry] = useState(false)
  const [reEntryDelay, setReEntryDelay] = useState('24h')
  const [isSaving, setIsSaving] = useState(false)

  async function handleCreate() {
    if (!name.trim() || !triggerType) return

    setIsSaving(true)
    try {
      const res = await fetch('/api/automations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          trigger_type: triggerType,
          trigger_config: {},
          steps: [],
          allow_re_entry: allowReEntry,
          re_entry_delay: allowReEntry ? reEntryDelay : null,
        }),
      })

      if (res.ok) {
        const data = await res.json()
        router.push(`/automations/${data.id}`)
      }
    } catch (err) {
      console.error('Failed to create automation:', err)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-4">
        <Link href="/automations">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <h1 className="text-3xl font-bold">New Automation</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Automation Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              placeholder="e.g. Welcome Series"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Trigger</Label>
            <Select value={triggerType} onValueChange={setTriggerType}>
              <SelectTrigger>
                <SelectValue placeholder="Select a trigger..." />
              </SelectTrigger>
              <SelectContent>
                {TRIGGER_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">
              The event that will start this automation for a contact.
            </p>
          </div>

          <div className="flex items-center justify-between rounded-lg border p-4">
            <div>
              <Label htmlFor="re-entry">Allow Re-entry</Label>
              <p className="text-sm text-muted-foreground">
                Allow contacts to go through this automation more than once.
              </p>
            </div>
            <Switch
              id="re-entry"
              checked={allowReEntry}
              onCheckedChange={setAllowReEntry}
            />
          </div>

          {allowReEntry && (
            <div className="space-y-2">
              <Label htmlFor="delay">Re-entry Delay</Label>
              <Select value={reEntryDelay} onValueChange={setReEntryDelay}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1h">1 hour</SelectItem>
                  <SelectItem value="12h">12 hours</SelectItem>
                  <SelectItem value="24h">24 hours</SelectItem>
                  <SelectItem value="3d">3 days</SelectItem>
                  <SelectItem value="7d">7 days</SelectItem>
                  <SelectItem value="30d">30 days</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">
                Minimum time before a contact can re-enter after completing.
              </p>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <Link href="/automations">
              <Button variant="outline">Cancel</Button>
            </Link>
            <Button
              onClick={handleCreate}
              disabled={!name.trim() || !triggerType || isSaving}
            >
              {isSaving ? 'Creating...' : 'Create & Build'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
