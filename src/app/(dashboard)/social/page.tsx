'use client'

import { useState, useEffect, useCallback } from 'react'
import { useWorkspace } from '@/lib/hooks/use-workspace'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { SocialAccount } from '@/lib/types'
import {
  Plus,
  Trash2,
  ExternalLink,
  RefreshCw,
  Facebook,
  Instagram,
  MapPin,
} from 'lucide-react'

const PLATFORM_CONFIG: Record<
  string,
  { label: string; color: string; bgColor: string; icon: React.ElementType; description: string }
> = {
  facebook: {
    label: 'Facebook',
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10 border-blue-500/20',
    icon: Facebook,
    description: 'Connect a Facebook Page to publish posts and manage engagement.',
  },
  instagram: {
    label: 'Instagram',
    color: 'text-pink-400',
    bgColor: 'bg-pink-500/10 border-pink-500/20',
    icon: Instagram,
    description: 'Connect an Instagram Business account for scheduling and publishing.',
  },
  google_business: {
    label: 'Google Business',
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/10 border-emerald-500/20',
    icon: MapPin,
    description: 'Connect Google Business Profile for local SEO and post updates.',
  },
}

export default function SocialPage() {
  const { workspace } = useWorkspace()
  const [accounts, setAccounts] = useState<SocialAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [showConnectDialog, setShowConnectDialog] = useState(false)
  const [connectPlatform, setConnectPlatform] = useState<string | null>(null)
  const [connectName, setConnectName] = useState('')
  const [connectPlatformId, setConnectPlatformId] = useState('')
  const [connecting, setConnecting] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const fetchAccounts = useCallback(async () => {
    if (!workspace) return
    setLoading(true)
    try {
      const res = await fetch(`/api/social/accounts?workspace_id=${workspace.id}`)
      if (res.ok) {
        const data = await res.json()
        setAccounts(data)
      }
    } catch (err) {
      console.log('Error fetching social accounts:', err)
    }
    setLoading(false)
  }, [workspace])

  useEffect(() => {
    fetchAccounts()
  }, [fetchAccounts])

  async function handleConnect() {
    if (!workspace || !connectPlatform || !connectName.trim()) return
    setConnecting(true)
    try {
      const res = await fetch('/api/social/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspace_id: workspace.id,
          platform: connectPlatform,
          platform_id: connectPlatformId || `manual_${Date.now()}`,
          platform_name: connectName.trim(),
          access_token: 'pending_oauth',
          is_active: true,
          metadata: {},
        }),
      })
      if (res.ok) {
        await fetchAccounts()
        setShowConnectDialog(false)
        setConnectPlatform(null)
        setConnectName('')
        setConnectPlatformId('')
      }
    } catch (err) {
      console.log('Error connecting account:', err)
    }
    setConnecting(false)
  }

  async function handleDelete(accountId: string) {
    setDeleting(true)
    try {
      const res = await fetch(`/api/social/accounts?id=${accountId}`, {
        method: 'DELETE',
      })
      if (res.ok) {
        setAccounts((prev) => prev.filter((a) => a.id !== accountId))
        setShowDeleteDialog(null)
      }
    } catch (err) {
      console.log('Error deleting account:', err)
    }
    setDeleting(false)
  }

  function openConnect(platform: string) {
    setConnectPlatform(platform)
    setConnectName('')
    setConnectPlatformId('')
    setShowConnectDialog(true)
  }

  const accountsByPlatform = (platform: string) =>
    accounts.filter((a) => a.platform === platform)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Social Channels</h1>
          <p className="text-slate-400 text-sm mt-1">
            Connect social media accounts for this sub-account to schedule and publish content.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchAccounts}
          className="border-slate-700 text-slate-300 hover:text-white"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Platform Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {Object.entries(PLATFORM_CONFIG).map(([platform, config]) => {
          const Icon = config.icon
          const connected = accountsByPlatform(platform)
          return (
            <div
              key={platform}
              className={`rounded-xl border p-5 ${config.bgColor}`}
            >
              <div className="flex items-center gap-3 mb-3">
                <div className={`p-2 rounded-lg bg-slate-900/60`}>
                  <Icon className={`h-5 w-5 ${config.color}`} />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white">{config.label}</h3>
                  <p className="text-xs text-slate-400">
                    {connected.length} connected
                  </p>
                </div>
              </div>
              <p className="text-xs text-slate-400 mb-4 leading-relaxed">
                {config.description}
              </p>
              <Button
                size="sm"
                onClick={() => openConnect(platform)}
                className="w-full bg-slate-800/80 hover:bg-slate-700 text-white border border-slate-700 text-xs"
              >
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                Connect {config.label}
              </Button>
            </div>
          )
        })}
      </div>

      {/* Connected Accounts List */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60">
        <div className="px-6 py-4 border-b border-slate-800">
          <h2 className="text-base font-semibold text-white">Connected Accounts</h2>
          <p className="text-xs text-slate-400 mt-1">
            {accounts.length} account{accounts.length !== 1 ? 's' : ''} connected to this sub-account
          </p>
        </div>
        <div className="divide-y divide-slate-800">
          {loading ? (
            <div className="p-8 text-center text-slate-400 text-sm">Loading...</div>
          ) : accounts.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-slate-400 text-sm">No social accounts connected yet.</p>
              <p className="text-slate-500 text-xs mt-1">
                Click one of the platform cards above to connect your first account.
              </p>
            </div>
          ) : (
            accounts.map((account) => {
              const config = PLATFORM_CONFIG[account.platform]
              const Icon = config?.icon || ExternalLink
              return (
                <div
                  key={account.id}
                  className="flex items-center gap-4 px-6 py-3.5 hover:bg-slate-800/30 transition-colors"
                >
                  <div className="p-1.5 rounded-md bg-slate-800/80">
                    <Icon className={`h-4 w-4 ${config?.color || 'text-slate-400'}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">
                      {account.platform_name}
                    </p>
                    <p className="text-xs text-slate-500">
                      {config?.label || account.platform} &middot;{' '}
                      {account.is_active ? (
                        <span className="text-emerald-400">Active</span>
                      ) : (
                        <span className="text-red-400">Disconnected</span>
                      )}
                    </p>
                  </div>
                  {account.profile_image_url && (
                    <img
                      src={account.profile_image_url}
                      alt=""
                      className="h-7 w-7 rounded-full ring-1 ring-slate-700"
                    />
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowDeleteDialog(account.id)}
                    className="text-slate-500 hover:text-red-400 h-8 w-8 p-0"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* Connect Dialog */}
      <Dialog open={showConnectDialog} onOpenChange={setShowConnectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Connect {connectPlatform ? PLATFORM_CONFIG[connectPlatform]?.label : 'Account'}
            </DialogTitle>
            <DialogDescription>
              Add a social media account to this sub-account. In production, this would redirect to OAuth. For now, enter the account details manually.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label className="text-slate-300">Account / Page Name</Label>
              <Input
                value={connectName}
                onChange={(e) => setConnectName(e.target.value)}
                placeholder="My Business Page"
                className="bg-slate-800/60 border-slate-700 text-white"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">Platform ID (optional)</Label>
              <Input
                value={connectPlatformId}
                onChange={(e) => setConnectPlatformId(e.target.value)}
                placeholder="123456789"
                className="bg-slate-800/60 border-slate-700 text-white"
              />
              <p className="text-xs text-slate-500">
                The page or account ID from the platform. Leave blank to auto-generate.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowConnectDialog(false)}
              disabled={connecting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleConnect}
              disabled={connecting || !connectName.trim()}
            >
              {connecting ? 'Connecting...' : 'Connect Account'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!showDeleteDialog} onOpenChange={() => setShowDeleteDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Disconnect Account</DialogTitle>
            <DialogDescription>
              Are you sure you want to disconnect this social account? Any scheduled posts for this account will fail.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(null)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => showDeleteDialog && handleDelete(showDeleteDialog)}
              disabled={deleting}
            >
              {deleting ? 'Disconnecting...' : 'Disconnect'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
