'use client'

import { useState, useEffect } from 'react'
import { useWorkspace } from '@/lib/hooks/use-workspace'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'

const TIMEZONES = [
  { value: 'America/New_York', label: 'Eastern Time (America/New_York)' },
  { value: 'America/Chicago', label: 'Central Time (America/Chicago)' },
  { value: 'America/Denver', label: 'Mountain Time (America/Denver)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (America/Los_Angeles)' },
  { value: 'America/Anchorage', label: 'Alaska Time (America/Anchorage)' },
  { value: 'America/Honolulu', label: 'Hawaii Time (America/Honolulu)' },
  { value: 'UTC', label: 'UTC' },
]

export default function SettingsPage() {
  const { workspace, refreshWorkspaces } = useWorkspace()

  // General tab state
  const [generalName, setGeneralName] = useState('')
  const [generalSlug, setGeneralSlug] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [companyAddress, setCompanyAddress] = useState('')
  const [timezone, setTimezone] = useState('America/New_York')
  const [generalSaving, setGeneralSaving] = useState(false)

  // Email tab state
  const [fromName, setFromName] = useState('')
  const [fromEmail, setFromEmail] = useState('')
  const [emailSaving, setEmailSaving] = useState(false)

  // SMS tab state
  const [twilioPhone, setTwilioPhone] = useState('')
  const [smsSaving, setSmsSaving] = useState(false)

  // Limits tab state
  const [monthlyEmailLimit, setMonthlyEmailLimit] = useState(0)
  const [monthlySmsLimit, setMonthlySmsLimit] = useState(0)
  const [limitsSaving, setLimitsSaving] = useState(false)

  // Danger zone
  const [showDeactivateDialog, setShowDeactivateDialog] = useState(false)
  const [deactivating, setDeactivating] = useState(false)

  // Populate form from workspace data
  useEffect(() => {
    if (!workspace) return

    const settings = (workspace.settings || {}) as Record<string, unknown>

    setGeneralName(workspace.name || '')
    setGeneralSlug(workspace.slug || '')
    setCompanyName((settings.company_name as string) || '')
    setCompanyAddress((settings.company_address as string) || '')
    setTimezone((settings.timezone as string) || 'America/New_York')

    setFromName(workspace.sendgrid_from_name || '')
    setFromEmail(workspace.sendgrid_from_email || '')

    setTwilioPhone(workspace.twilio_phone_number || '')

    setMonthlyEmailLimit(workspace.monthly_email_limit || 0)
    setMonthlySmsLimit(workspace.monthly_sms_limit || 0)
  }, [workspace])

  async function saveWorkspace(fields: Record<string, unknown>) {
    if (!workspace) return false

    try {
      const response = await fetch(`/api/workspaces/${workspace.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fields),
      })

      if (!response.ok) {
        const data = await response.json()
        console.log('Error saving settings:', data.error || 'Unknown error')
        return false
      }

      await refreshWorkspaces()
      console.log('Settings saved successfully')
      return true
    } catch (err) {
      console.log('Error saving settings:', err)
      return false
    }
  }

  async function handleGeneralSave() {
    setGeneralSaving(true)
    const currentSettings = (workspace?.settings || {}) as Record<string, unknown>
    await saveWorkspace({
      name: generalName,
      settings: {
        ...currentSettings,
        company_name: companyName,
        company_address: companyAddress,
        timezone,
      },
    })
    setGeneralSaving(false)
  }

  async function handleEmailSave() {
    setEmailSaving(true)
    await saveWorkspace({
      sendgrid_from_name: fromName,
      sendgrid_from_email: fromEmail,
    })
    setEmailSaving(false)
  }

  async function handleSmsSave() {
    setSmsSaving(true)
    await saveWorkspace({
      twilio_phone_number: twilioPhone || null,
    })
    setSmsSaving(false)
  }

  async function handleLimitsSave() {
    setLimitsSaving(true)
    await saveWorkspace({
      monthly_email_limit: monthlyEmailLimit,
      monthly_sms_limit: monthlySmsLimit,
    })
    setLimitsSaving(false)
  }

  async function handleDeactivate() {
    if (!workspace) return
    setDeactivating(true)
    try {
      const response = await fetch(`/api/workspaces/${workspace.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: { ...workspace.settings, is_active: false } }),
      })
      if (response.ok) {
        console.log('Workspace deactivated')
        setShowDeactivateDialog(false)
        await refreshWorkspaces()
      } else {
        console.log('Failed to deactivate workspace')
      }
    } catch (err) {
      console.log('Error deactivating workspace:', err)
    }
    setDeactivating(false)
  }

  if (!workspace) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground">No workspace selected.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground">
          Manage your workspace configuration and preferences.
        </p>
      </div>

      <Tabs defaultValue="general" className="space-y-6">
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="email">Email</TabsTrigger>
          <TabsTrigger value="sms">SMS</TabsTrigger>
          <TabsTrigger value="limits">Limits</TabsTrigger>
        </TabsList>

        {/* ===================== General Tab ===================== */}
        <TabsContent value="general">
          <Card>
            <CardHeader>
              <CardTitle>General Settings</CardTitle>
              <CardDescription>
                Basic workspace information and company details.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-2">
                <Label htmlFor="workspace-name">Workspace Name</Label>
                <Input
                  id="workspace-name"
                  value={generalName}
                  onChange={(e) => setGeneralName(e.target.value)}
                  placeholder="My Workspace"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="workspace-slug">Workspace Slug</Label>
                <Input
                  id="workspace-slug"
                  value={generalSlug}
                  readOnly
                  className="bg-muted"
                />
                <p className="text-xs text-muted-foreground">
                  The slug cannot be changed after workspace creation.
                </p>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="company-name">Company Name</Label>
                <Input
                  id="company-name"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="Acme Corp"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="company-address">Company Address</Label>
                <Textarea
                  id="company-address"
                  value={companyAddress}
                  onChange={(e) => setCompanyAddress(e.target.value)}
                  placeholder="123 Main St, Suite 100&#10;New York, NY 10001"
                  rows={3}
                />
                <p className="text-xs text-muted-foreground">
                  Required for CAN-SPAM compliance. Included in email footers.
                </p>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="timezone">Timezone</Label>
                <Select value={timezone} onValueChange={setTimezone}>
                  <SelectTrigger id="timezone">
                    <SelectValue placeholder="Select timezone" />
                  </SelectTrigger>
                  <SelectContent>
                    {TIMEZONES.map((tz) => (
                      <SelectItem key={tz.value} value={tz.value}>
                        {tz.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex justify-end">
                <Button onClick={handleGeneralSave} disabled={generalSaving}>
                  {generalSaving ? 'Saving...' : 'Save'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===================== Email Tab ===================== */}
        <TabsContent value="email">
          <Card>
            <CardHeader>
              <CardTitle>Email Settings</CardTitle>
              <CardDescription>
                Configure default sender information for email campaigns.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-2">
                <Label htmlFor="from-name">Default From Name</Label>
                <Input
                  id="from-name"
                  value={fromName}
                  onChange={(e) => setFromName(e.target.value)}
                  placeholder="Acme Corp"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="from-email">Default From Email</Label>
                <Input
                  id="from-email"
                  type="email"
                  value={fromEmail}
                  onChange={(e) => setFromEmail(e.target.value)}
                  placeholder="hello@acme.com"
                />
              </div>

              <div className="flex justify-end">
                <Button onClick={handleEmailSave} disabled={emailSaving}>
                  {emailSaving ? 'Saving...' : 'Save'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===================== SMS Tab ===================== */}
        <TabsContent value="sms">
          <Card>
            <CardHeader>
              <CardTitle>SMS Settings</CardTitle>
              <CardDescription>
                Configure Twilio phone number and SMS settings.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-2">
                <Label htmlFor="twilio-phone">Twilio Phone Number</Label>
                <Input
                  id="twilio-phone"
                  value={twilioPhone}
                  readOnly
                  className="bg-muted"
                  placeholder="Not configured"
                />
                <p className="text-xs text-muted-foreground">
                  Configure Twilio in your environment settings. The phone number
                  is managed through your Twilio account.
                </p>
              </div>

              <div className="flex justify-end">
                <Button onClick={handleSmsSave} disabled={smsSaving}>
                  {smsSaving ? 'Saving...' : 'Save'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===================== Limits Tab ===================== */}
        <TabsContent value="limits">
          <Card>
            <CardHeader>
              <CardTitle>Usage Limits</CardTitle>
              <CardDescription>
                Set monthly sending limits to control costs and prevent accidental overuse.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-2">
                <Label htmlFor="email-limit">Monthly Email Limit</Label>
                <Input
                  id="email-limit"
                  type="number"
                  min={0}
                  value={monthlyEmailLimit}
                  onChange={(e) => setMonthlyEmailLimit(parseInt(e.target.value, 10) || 0)}
                  placeholder="10000"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="sms-limit">Monthly SMS Limit</Label>
                <Input
                  id="sms-limit"
                  type="number"
                  min={0}
                  value={monthlySmsLimit}
                  onChange={(e) => setMonthlySmsLimit(parseInt(e.target.value, 10) || 0)}
                  placeholder="1000"
                />
              </div>

              <div className="flex justify-end">
                <Button onClick={handleLimitsSave} disabled={limitsSaving}>
                  {limitsSaving ? 'Saving...' : 'Save'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ===================== Danger Zone ===================== */}
      <Separator />

      <Card className="border-destructive">
        <CardHeader>
          <CardTitle className="text-destructive">Danger Zone</CardTitle>
          <CardDescription>
            Irreversible actions that affect your entire workspace.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Deactivate Workspace</p>
              <p className="text-sm text-muted-foreground">
                This will disable all campaigns and integrations for this workspace.
              </p>
            </div>
            <Button
              variant="destructive"
              onClick={() => setShowDeactivateDialog(true)}
            >
              Deactivate
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Deactivate Confirmation Dialog */}
      <Dialog open={showDeactivateDialog} onOpenChange={setShowDeactivateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Deactivate Workspace</DialogTitle>
            <DialogDescription>
              Are you sure you want to deactivate &ldquo;{workspace.name}&rdquo;? This will
              stop all active campaigns, automations, and scheduled posts. This action
              can be reversed by contacting support.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDeactivateDialog(false)}
              disabled={deactivating}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeactivate}
              disabled={deactivating}
            >
              {deactivating ? 'Deactivating...' : 'Yes, Deactivate'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
