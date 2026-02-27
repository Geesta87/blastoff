'use client'

import { use, useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  Send,
  Pause,
  XCircle,
  Pencil,
  Loader2,
  Mail,
  MousePointerClick,
  Eye,
  AlertTriangle,
  Users,
  Ban,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import type { EmailCampaign, EmailSend, CampaignStatus } from '@/lib/types'

interface SendWithContact extends EmailSend {
  contact?: {
    id: string
    first_name: string | null
    last_name: string | null
    email: string | null
    full_name: string | null
  }
}

interface SendsResponse {
  sends: SendWithContact[]
  total: number
  page: number
  limit: number
  totalPages: number
}

function StatusBadge({ status }: { status: CampaignStatus }) {
  switch (status) {
    case 'draft':
      return <Badge variant="secondary">Draft</Badge>
    case 'scheduled':
      return <Badge variant="default">Scheduled</Badge>
    case 'sending':
      return (
        <Badge variant="destructive" className="animate-pulse">
          Sending
        </Badge>
      )
    case 'sent':
      return (
        <Badge className="bg-green-100 text-green-800 border-transparent">
          Sent
        </Badge>
      )
    case 'paused':
      return (
        <Badge className="bg-orange-100 text-orange-800 border-transparent">
          Paused
        </Badge>
      )
    case 'cancelled':
      return <Badge variant="secondary">Cancelled</Badge>
    case 'failed':
      return <Badge variant="destructive">Failed</Badge>
    default:
      return <Badge variant="secondary">{status}</Badge>
  }
}

function SendStatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'queued':
      return <Badge variant="secondary">Queued</Badge>
    case 'sent':
      return <Badge variant="default">Sent</Badge>
    case 'delivered':
      return (
        <Badge className="bg-green-100 text-green-800 border-transparent">
          Delivered
        </Badge>
      )
    case 'opened':
      return (
        <Badge className="bg-blue-100 text-blue-800 border-transparent">
          Opened
        </Badge>
      )
    case 'clicked':
      return (
        <Badge className="bg-purple-100 text-purple-800 border-transparent">
          Clicked
        </Badge>
      )
    case 'bounced':
      return <Badge variant="destructive">Bounced</Badge>
    case 'complained':
      return (
        <Badge className="bg-orange-100 text-orange-800 border-transparent">
          Complained
        </Badge>
      )
    case 'failed':
      return <Badge variant="destructive">Failed</Badge>
    default:
      return <Badge variant="secondary">{status}</Badge>
  }
}

function formatDateTime(dateStr: string | null): string {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleString()
}

export default function EmailCampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const router = useRouter()

  const [campaign, setCampaign] = useState<EmailCampaign | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [sends, setSends] = useState<SendWithContact[]>([])
  const [sendsTotal, setSendsTotal] = useState(0)
  const [sendsPage, setSendsPage] = useState(1)
  const [sendsTotalPages, setSendsTotalPages] = useState(1)
  const [sendsLoading, setSendsLoading] = useState(false)
  const [statusFilter, setStatusFilter] = useState('all')
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [confirmAction, setConfirmAction] = useState<'send' | 'pause' | 'cancel' | null>(null)
  const [actionLoading, setActionLoading] = useState(false)

  const fetchCampaign = useCallback(async () => {
    try {
      const res = await fetch(`/api/campaigns/email/${id}`)
      if (res.ok) {
        const data = await res.json()
        setCampaign(data)
      }
    } catch (err) {
      console.error('Failed to fetch campaign:', err)
    } finally {
      setIsLoading(false)
    }
  }, [id])

  const fetchSends = useCallback(async () => {
    setSendsLoading(true)
    try {
      const params = new URLSearchParams({
        page: sendsPage.toString(),
        limit: '50',
      })
      if (statusFilter !== 'all') {
        params.set('status', statusFilter)
      }
      const res = await fetch(`/api/campaigns/email/${id}/sends?${params}`)
      if (res.ok) {
        const data: SendsResponse = await res.json()
        setSends(data.sends)
        setSendsTotal(data.total)
        setSendsTotalPages(data.totalPages)
      }
    } catch (err) {
      console.error('Failed to fetch sends:', err)
    } finally {
      setSendsLoading(false)
    }
  }, [id, sendsPage, statusFilter])

  useEffect(() => {
    fetchCampaign()
  }, [fetchCampaign])

  useEffect(() => {
    if (campaign) {
      fetchSends()
    }
  }, [campaign, fetchSends])

  // Auto-refresh when sending
  useEffect(() => {
    if (campaign?.status !== 'sending') return
    const interval = setInterval(() => {
      fetchCampaign()
      fetchSends()
    }, 5000)
    return () => clearInterval(interval)
  }, [campaign?.status, fetchCampaign, fetchSends])

  async function handleAction(action: 'send' | 'pause' | 'cancel') {
    setActionLoading(true)
    try {
      if (action === 'send') {
        const res = await fetch(`/api/campaigns/email/${id}/send`, { method: 'POST' })
        if (!res.ok) {
          const err = await res.json()
          throw new Error(err.error || 'Failed to send')
        }
      } else if (action === 'pause') {
        const res = await fetch(`/api/campaigns/email/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'paused' }),
        })
        if (!res.ok) throw new Error('Failed to pause')
      } else if (action === 'cancel') {
        const res = await fetch(`/api/campaigns/email/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'cancelled' }),
        })
        if (!res.ok) throw new Error('Failed to cancel')
      }
      await fetchCampaign()
    } catch (err) {
      console.error('Action failed:', err)
      alert(err instanceof Error ? err.message : 'Action failed')
    } finally {
      setActionLoading(false)
      setShowConfirmDialog(false)
      setConfirmAction(null)
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-64" />
      </div>
    )
  }

  if (!campaign) {
    return (
      <div className="space-y-4">
        <h1 className="text-3xl font-bold">Campaign Not Found</h1>
        <Link href="/campaigns/email">
          <Button variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Campaigns
          </Button>
        </Link>
      </div>
    )
  }

  const sentProgress =
    campaign.total_recipients > 0
      ? (campaign.total_sent / campaign.total_recipients) * 100
      : 0
  const openRate =
    campaign.total_sent > 0
      ? ((campaign.total_opened / campaign.total_sent) * 100).toFixed(1)
      : '0.0'
  const clickRate =
    campaign.total_sent > 0
      ? ((campaign.total_clicked / campaign.total_sent) * 100).toFixed(1)
      : '0.0'
  const bounceRate =
    campaign.total_sent > 0
      ? ((campaign.total_bounced / campaign.total_sent) * 100).toFixed(1)
      : '0.0'

  const funnelData = [
    { name: 'Sent', value: campaign.total_sent },
    { name: 'Delivered', value: campaign.total_delivered },
    { name: 'Opened', value: campaign.total_opened },
    { name: 'Clicked', value: campaign.total_clicked },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/campaigns/email">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold">{campaign.name}</h1>
              <StatusBadge status={campaign.status} />
            </div>
            {campaign.subject && (
              <p className="text-muted-foreground mt-1">
                Subject: {campaign.subject}
              </p>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          {campaign.status === 'draft' && (
            <>
              <Button
                variant="outline"
                onClick={() => router.push(`/campaigns/email/new?edit=${id}`)}
              >
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </Button>
              <Button
                onClick={() => {
                  setConfirmAction('send')
                  setShowConfirmDialog(true)
                }}
              >
                <Send className="mr-2 h-4 w-4" />
                Send
              </Button>
            </>
          )}
          {campaign.status === 'sending' && (
            <Button
              variant="outline"
              onClick={() => {
                setConfirmAction('pause')
                setShowConfirmDialog(true)
              }}
            >
              <Pause className="mr-2 h-4 w-4" />
              Pause
            </Button>
          )}
          {campaign.status === 'scheduled' && (
            <Button
              variant="outline"
              onClick={() => {
                setConfirmAction('cancel')
                setShowConfirmDialog(true)
              }}
            >
              <XCircle className="mr-2 h-4 w-4" />
              Cancel Schedule
            </Button>
          )}
        </div>
      </div>

      {/* Sending Progress */}
      {campaign.status === 'sending' && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3 mb-2">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <span className="font-medium">
                Sending in progress... {campaign.total_sent} of{' '}
                {campaign.total_recipients} sent
              </span>
            </div>
            <Progress value={sentProgress} />
          </CardContent>
        </Card>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <Mail className="h-4 w-4" />
              <span className="text-sm font-medium">Sent</span>
            </div>
            <div className="text-2xl font-bold">
              {campaign.total_sent.toLocaleString()}
              <span className="text-sm font-normal text-muted-foreground">
                {' '}
                / {campaign.total_recipients.toLocaleString()}
              </span>
            </div>
            <Progress value={sentProgress} className="mt-2" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <Eye className="h-4 w-4" />
              <span className="text-sm font-medium">Opened</span>
            </div>
            <div className="text-2xl font-bold">
              {campaign.total_opened.toLocaleString()}
            </div>
            <p className="text-sm text-muted-foreground mt-1">{openRate}% open rate</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <MousePointerClick className="h-4 w-4" />
              <span className="text-sm font-medium">Clicked</span>
            </div>
            <div className="text-2xl font-bold">
              {campaign.total_clicked.toLocaleString()}
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {clickRate}% click rate
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-sm font-medium">Bounced</span>
            </div>
            <div className="text-2xl font-bold">
              {campaign.total_bounced.toLocaleString()}
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {bounceRate}% bounce rate
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6 flex items-center gap-3">
            <Users className="h-5 w-5 text-muted-foreground" />
            <div>
              <div className="text-sm text-muted-foreground">Delivered</div>
              <div className="text-lg font-semibold">
                {campaign.total_delivered.toLocaleString()}
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-muted-foreground" />
            <div>
              <div className="text-sm text-muted-foreground">Complained</div>
              <div className="text-lg font-semibold">
                {campaign.total_complained.toLocaleString()}
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 flex items-center gap-3">
            <Ban className="h-5 w-5 text-muted-foreground" />
            <div>
              <div className="text-sm text-muted-foreground">Unsubscribed</div>
              <div className="text-lg font-semibold">
                {campaign.total_unsubscribed.toLocaleString()}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Funnel Chart */}
      {campaign.total_sent > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Engagement Funnel</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={funnelData}>
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Individual Sends */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Individual Sends</CardTitle>
            <div className="flex items-center gap-2">
              <Select
                value={statusFilter}
                onValueChange={(val) => {
                  setStatusFilter(val)
                  setSendsPage(1)
                }}
              >
                <SelectTrigger className="w-[150px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="sent">Sent</SelectItem>
                  <SelectItem value="delivered">Delivered</SelectItem>
                  <SelectItem value="opened">Opened</SelectItem>
                  <SelectItem value="clicked">Clicked</SelectItem>
                  <SelectItem value="bounced">Bounced</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                </SelectContent>
              </Select>
              <span className="text-sm text-muted-foreground">
                {sendsTotal.toLocaleString()} total
              </span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {sendsLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : sends.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No sends found for this campaign.
            </p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Contact Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Sent At</TableHead>
                    <TableHead>Opened At</TableHead>
                    <TableHead>Clicked At</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sends.map((send) => (
                    <TableRow key={send.id}>
                      <TableCell className="font-medium">
                        {send.contact?.full_name ||
                          [send.contact?.first_name, send.contact?.last_name]
                            .filter(Boolean)
                            .join(' ') ||
                          '-'}
                      </TableCell>
                      <TableCell>{send.contact?.email || '-'}</TableCell>
                      <TableCell>
                        <SendStatusBadge status={send.status} />
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {formatDateTime(send.sent_at)}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {formatDateTime(send.opened_at)}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {formatDateTime(send.clicked_at)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination */}
              {sendsTotalPages > 1 && (
                <div className="flex items-center justify-between pt-4">
                  <p className="text-sm text-muted-foreground">
                    Page {sendsPage} of {sendsTotalPages}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={sendsPage <= 1}
                      onClick={() => setSendsPage((p) => p - 1)}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={sendsPage >= sendsTotalPages}
                      onClick={() => setSendsPage((p) => p + 1)}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Action Confirm Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {confirmAction === 'send' && 'Send Campaign?'}
              {confirmAction === 'pause' && 'Pause Campaign?'}
              {confirmAction === 'cancel' && 'Cancel Scheduled Campaign?'}
            </DialogTitle>
            <DialogDescription>
              {confirmAction === 'send' &&
                `This will start sending to ${campaign.total_recipients.toLocaleString()} recipients.`}
              {confirmAction === 'pause' &&
                'This will pause the campaign. You can resume it later.'}
              {confirmAction === 'cancel' &&
                'This will cancel the scheduled send. The campaign will be moved back to draft.'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowConfirmDialog(false)
                setConfirmAction(null)
              }}
              disabled={actionLoading}
            >
              Cancel
            </Button>
            <Button
              onClick={() => confirmAction && handleAction(confirmAction)}
              disabled={actionLoading}
              variant={confirmAction === 'cancel' ? 'destructive' : 'default'}
            >
              {actionLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {confirmAction === 'send' && 'Yes, Send'}
              {confirmAction === 'pause' && 'Yes, Pause'}
              {confirmAction === 'cancel' && 'Yes, Cancel'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
