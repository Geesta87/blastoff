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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import {
  Building2,
  Globe,
  Phone,
  Mail,
  MessageSquare,
  Shield,
  Gauge,
  ImageIcon,
} from 'lucide-react'

const TIMEZONES = [
  { value: 'America/New_York', label: 'Eastern Time (ET)' },
  { value: 'America/Chicago', label: 'Central Time (CT)' },
  { value: 'America/Denver', label: 'Mountain Time (MT)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { value: 'America/Anchorage', label: 'Alaska Time (AKT)' },
  { value: 'America/Honolulu', label: 'Hawaii Time (HT)' },
  { value: 'UTC', label: 'UTC' },
  { value: 'Europe/London', label: 'London (GMT/BST)' },
  { value: 'Europe/Paris', label: 'Central Europe (CET)' },
  { value: 'Asia/Tokyo', label: 'Tokyo (JST)' },
  { value: 'Australia/Sydney', label: 'Sydney (AEST)' },
]

const INDUSTRIES = [
  'Agency / Marketing',
  'E-commerce / Retail',
  'Real Estate',
  'Healthcare',
  'Finance / Insurance',
  'Education',
  'SaaS / Technology',
  'Hospitality / Travel',
  'Fitness / Wellness',
  'Legal Services',
  'Non-Profit',
  'Other',
]

type SettingsTab = 'profile' | 'email' | 'sms' | 'limits'

export default function SettingsPage() {
  const { workspace, refreshWorkspaces } = useWorkspace()
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile')

  // Profile tab state
  const [profileName, setProfileName] = useState('')
  const [profileSlug, setProfileSlug] = useState('')
  const [logoUrl, setLogoUrl] = useState('')
  const [websiteUrl, setWebsiteUrl] = useState('')
  const [businessPhone, setBusinessPhone] = useState('')
  const [industry, setIndustry] = useState('')
  const [profileDescription, setProfileDescription] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [companyAddress, setCompanyAddress] = useState('')
  const [timezone, setTimezone] = useState('America/New_York')
  const [profileSaving, setProfileSaving] = useState(false)

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

    setProfileName(workspace.name || '')
    setProfileSlug(workspace.slug || '')
    setLogoUrl(workspace.logo_url || '')
    setWebsiteUrl(workspace.website || '')
    setBusinessPhone(workspace.business_phone || '')
    setIndustry(workspace.industry || '')
    setProfileDescription(workspace.description || '')
    setCompanyName(workspace.company_name || '')
    setCompanyAddress(workspace.company_address || '')
    setTimezone(workspace.timezone || 'America/New_York')

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
      return true
    } catch (err) {
      console.log('Error saving settings:', err)
      return false
    }
  }

  async function handleProfileSave() {
    setProfileSaving(true)
    await saveWorkspace({
      name: profileName,
      logo_url: logoUrl || null,
      website: websiteUrl || null,
      business_phone: businessPhone || null,
      industry: industry || null,
      description: profileDescription || null,
      company_name: companyName || null,
      company_address: companyAddress || null,
      timezone,
    })
    setProfileSaving(false)
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
        setShowDeactivateDialog(false)
        await refreshWorkspaces()
      }
    } catch (err) {
      console.log('Error deactivating:', err)
    }
    setDeactivating(false)
  }

  if (!workspace) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="text-slate-400">No sub-account selected.</p>
      </div>
    )
  }

  const tabs: { id: SettingsTab; label: string; icon: React.ElementType }[] = [
    { id: 'profile', label: 'Profile', icon: Building2 },
    { id: 'email', label: 'Email', icon: Mail },
    { id: 'sms', label: 'SMS', icon: MessageSquare },
    { id: 'limits', label: 'Limits', icon: Gauge },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Sub-Account Settings</h1>
        <p className="text-slate-400 text-sm mt-1">
          Manage the profile, integrations, and preferences for{' '}
          <span className="text-white font-medium">{workspace.name}</span>.
        </p>
      </div>

      <div className="flex gap-6">
        {/* Left Tab Navigation */}
        <div className="w-52 shrink-0 space-y-1">
          {tabs.map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-primary/20 text-primary border border-primary/20'
                    : 'text-slate-400 hover:bg-slate-800/50 hover:text-white'
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {tab.label}
              </button>
            )
          })}
        </div>

        {/* Right Content */}
        <div className="flex-1 min-w-0">
          {/* ===================== Profile Tab ===================== */}
          {activeTab === 'profile' && (
            <div className="space-y-6">
              {/* Brand Identity Card */}
              <div className="rounded-xl border border-slate-800 bg-slate-900/60">
                <div className="px-6 py-4 border-b border-slate-800">
                  <h2 className="text-base font-semibold text-white flex items-center gap-2">
                    <Globe className="h-4 w-4 text-primary" />
                    Brand Identity
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">
                    This information represents the sub-account&apos;s brand across all campaigns.
                  </p>
                </div>
                <div className="p-6 space-y-5">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="profile-name" className="text-slate-300 text-sm">
                        Sub-Account Name
                      </Label>
                      <Input
                        id="profile-name"
                        value={profileName}
                        onChange={(e) => setProfileName(e.target.value)}
                        placeholder="My Business"
                        className="bg-slate-800/60 border-slate-700 text-white"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="profile-slug" className="text-slate-300 text-sm">
                        Slug
                      </Label>
                      <Input
                        id="profile-slug"
                        value={profileSlug}
                        readOnly
                        className="bg-slate-800/40 border-slate-700 text-slate-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="logo-url" className="text-slate-300 text-sm flex items-center gap-1.5">
                        <ImageIcon className="h-3.5 w-3.5" />
                        Logo URL
                      </Label>
                      <Input
                        id="logo-url"
                        value={logoUrl}
                        onChange={(e) => setLogoUrl(e.target.value)}
                        placeholder="https://example.com/logo.png"
                        className="bg-slate-800/60 border-slate-700 text-white"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="website" className="text-slate-300 text-sm flex items-center gap-1.5">
                        <Globe className="h-3.5 w-3.5" />
                        Website
                      </Label>
                      <Input
                        id="website"
                        value={websiteUrl}
                        onChange={(e) => setWebsiteUrl(e.target.value)}
                        placeholder="https://example.com"
                        className="bg-slate-800/60 border-slate-700 text-white"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="business-phone" className="text-slate-300 text-sm flex items-center gap-1.5">
                        <Phone className="h-3.5 w-3.5" />
                        Business Phone
                      </Label>
                      <Input
                        id="business-phone"
                        value={businessPhone}
                        onChange={(e) => setBusinessPhone(e.target.value)}
                        placeholder="+1 (555) 000-0000"
                        className="bg-slate-800/60 border-slate-700 text-white"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="industry" className="text-slate-300 text-sm">
                        Industry
                      </Label>
                      <Select value={industry} onValueChange={setIndustry}>
                        <SelectTrigger id="industry" className="bg-slate-800/60 border-slate-700 text-white">
                          <SelectValue placeholder="Select industry" />
                        </SelectTrigger>
                        <SelectContent>
                          {INDUSTRIES.map((ind) => (
                            <SelectItem key={ind} value={ind}>
                              {ind}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="profile-desc" className="text-slate-300 text-sm">
                      Description
                    </Label>
                    <Textarea
                      id="profile-desc"
                      value={profileDescription}
                      onChange={(e) => setProfileDescription(e.target.value)}
                      placeholder="Brief description of this sub-account or business..."
                      rows={2}
                      className="bg-slate-800/60 border-slate-700 text-white resize-none"
                    />
                  </div>
                </div>
              </div>

              {/* Company / Compliance Card */}
              <div className="rounded-xl border border-slate-800 bg-slate-900/60">
                <div className="px-6 py-4 border-b border-slate-800">
                  <h2 className="text-base font-semibold text-white flex items-center gap-2">
                    <Shield className="h-4 w-4 text-emerald-400" />
                    Company &amp; Compliance
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">
                    Required for CAN-SPAM compliance. Included in email footers.
                  </p>
                </div>
                <div className="p-6 space-y-5">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="company-name" className="text-slate-300 text-sm">
                        Company Name
                      </Label>
                      <Input
                        id="company-name"
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        placeholder="Acme Corp"
                        className="bg-slate-800/60 border-slate-700 text-white"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="timezone" className="text-slate-300 text-sm">
                        Timezone
                      </Label>
                      <Select value={timezone} onValueChange={setTimezone}>
                        <SelectTrigger id="timezone" className="bg-slate-800/60 border-slate-700 text-white">
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
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="company-address" className="text-slate-300 text-sm">
                      Company Address
                    </Label>
                    <Textarea
                      id="company-address"
                      value={companyAddress}
                      onChange={(e) => setCompanyAddress(e.target.value)}
                      placeholder={"123 Main St, Suite 100\nNew York, NY 10001"}
                      rows={2}
                      className="bg-slate-800/60 border-slate-700 text-white resize-none"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <Button
                  onClick={handleProfileSave}
                  disabled={profileSaving}
                  className="bg-primary hover:bg-primary/90 text-white px-6"
                >
                  {profileSaving ? 'Saving...' : 'Save Profile'}
                </Button>
              </div>
            </div>
          )}

          {/* ===================== Email Tab ===================== */}
          {activeTab === 'email' && (
            <div className="rounded-xl border border-slate-800 bg-slate-900/60">
              <div className="px-6 py-4 border-b border-slate-800">
                <h2 className="text-base font-semibold text-white flex items-center gap-2">
                  <Mail className="h-4 w-4 text-blue-400" />
                  Email Integration
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Configure the default sender for this sub-account&apos;s email campaigns.
                </p>
              </div>
              <div className="p-6 space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="from-name" className="text-slate-300 text-sm">
                      Default From Name
                    </Label>
                    <Input
                      id="from-name"
                      value={fromName}
                      onChange={(e) => setFromName(e.target.value)}
                      placeholder="Acme Corp"
                      className="bg-slate-800/60 border-slate-700 text-white"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="from-email" className="text-slate-300 text-sm">
                      Default From Email
                    </Label>
                    <Input
                      id="from-email"
                      type="email"
                      value={fromEmail}
                      onChange={(e) => setFromEmail(e.target.value)}
                      placeholder="hello@acme.com"
                      className="bg-slate-800/60 border-slate-700 text-white"
                    />
                  </div>
                </div>

                <div className="rounded-lg border border-slate-700/50 bg-slate-800/30 p-4">
                  <p className="text-xs text-slate-400">
                    Email sending is powered by SendGrid. Each sub-account can use its own sender identity. Make sure your from email is verified in your SendGrid account.
                  </p>
                </div>

                <div className="flex justify-end">
                  <Button
                    onClick={handleEmailSave}
                    disabled={emailSaving}
                    className="bg-primary hover:bg-primary/90 text-white px-6"
                  >
                    {emailSaving ? 'Saving...' : 'Save Email Settings'}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* ===================== SMS Tab ===================== */}
          {activeTab === 'sms' && (
            <div className="rounded-xl border border-slate-800 bg-slate-900/60">
              <div className="px-6 py-4 border-b border-slate-800">
                <h2 className="text-base font-semibold text-white flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-emerald-400" />
                  SMS Integration
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Configure Twilio for this sub-account&apos;s SMS campaigns.
                </p>
              </div>
              <div className="p-6 space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="twilio-phone" className="text-slate-300 text-sm">
                    Twilio Phone Number
                  </Label>
                  <Input
                    id="twilio-phone"
                    value={twilioPhone}
                    onChange={(e) => setTwilioPhone(e.target.value)}
                    placeholder="+1 (555) 000-0000"
                    className="bg-slate-800/60 border-slate-700 text-white"
                  />
                </div>

                <div className="rounded-lg border border-slate-700/50 bg-slate-800/30 p-4">
                  <p className="text-xs text-slate-400">
                    SMS is powered by Twilio. Each sub-account can have its own dedicated phone number for sending campaigns and receiving replies.
                  </p>
                </div>

                <div className="flex justify-end">
                  <Button
                    onClick={handleSmsSave}
                    disabled={smsSaving}
                    className="bg-primary hover:bg-primary/90 text-white px-6"
                  >
                    {smsSaving ? 'Saving...' : 'Save SMS Settings'}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* ===================== Limits Tab ===================== */}
          {activeTab === 'limits' && (
            <div className="rounded-xl border border-slate-800 bg-slate-900/60">
              <div className="px-6 py-4 border-b border-slate-800">
                <h2 className="text-base font-semibold text-white flex items-center gap-2">
                  <Gauge className="h-4 w-4 text-amber-400" />
                  Usage Limits
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Set monthly sending limits per sub-account to control costs.
                </p>
              </div>
              <div className="p-6 space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="email-limit" className="text-slate-300 text-sm">
                      Monthly Email Limit
                    </Label>
                    <Input
                      id="email-limit"
                      type="number"
                      min={0}
                      value={monthlyEmailLimit}
                      onChange={(e) => setMonthlyEmailLimit(parseInt(e.target.value, 10) || 0)}
                      placeholder="10000"
                      className="bg-slate-800/60 border-slate-700 text-white"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="sms-limit" className="text-slate-300 text-sm">
                      Monthly SMS Limit
                    </Label>
                    <Input
                      id="sms-limit"
                      type="number"
                      min={0}
                      value={monthlySmsLimit}
                      onChange={(e) => setMonthlySmsLimit(parseInt(e.target.value, 10) || 0)}
                      placeholder="1000"
                      className="bg-slate-800/60 border-slate-700 text-white"
                    />
                  </div>
                </div>

                <div className="rounded-lg border border-slate-700/50 bg-slate-800/30 p-4">
                  <p className="text-xs text-slate-400">
                    Set to 0 for unlimited. When a sub-account reaches its limit, campaigns will be paused automatically until the next billing cycle.
                  </p>
                </div>

                <div className="flex justify-end">
                  <Button
                    onClick={handleLimitsSave}
                    disabled={limitsSaving}
                    className="bg-primary hover:bg-primary/90 text-white px-6"
                  >
                    {limitsSaving ? 'Saving...' : 'Save Limits'}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* ===================== Danger Zone (always visible) ===================== */}
          <Separator className="my-6 bg-slate-800" />

          <div className="rounded-xl border border-red-900/50 bg-red-950/20">
            <div className="px-6 py-4 border-b border-red-900/30">
              <h2 className="text-base font-semibold text-red-400">Danger Zone</h2>
            </div>
            <div className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-white text-sm">Deactivate Sub-Account</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Stops all campaigns, automations, and integrations for this sub-account.
                  </p>
                </div>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setShowDeactivateDialog(true)}
                >
                  Deactivate
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Deactivate Confirmation Dialog */}
      <Dialog open={showDeactivateDialog} onOpenChange={setShowDeactivateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Deactivate Sub-Account</DialogTitle>
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
