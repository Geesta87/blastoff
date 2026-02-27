'use client'

import { use, useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  Send,
  Trash2,
  Loader2,
  MessageSquare,
  Users,
  CheckCircle,
  XCircle,
  DollarSign,
  Hash,
  Pencil,
  Pause,
  Play,
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
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { COST_PER_SEGMENT } from '@/lib/utils/sms-segments'
import type { SmsCampaign, CampaignStatus } from '@/lib/types'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SmsSendWithContact {
  id: string
  campaign_id: string
  contact_id: string
  twilio_sid: string | null
  to_number: string
  body: string
  status: string
  segments: number
  cost: number | null
  error_code: string | null
  error_message: string | null
  sent_at: string | null
  delivered_at: string | null
  contact: {
    id: string
    first_name: string | null
    last_name: string | null
    phone: string | null
    full_name: string | null
  } | null
}

interface SendsResponse {
  sends: SmsSendWithContact[]
  total: number
  page: number
  limit: number
  totalPages: number
}

// ---------------------------------------------------------------------------
// Status badges
// ---------------------------------------------------------------------------

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
    case 'undelivered':
      return (
        <Badge className="bg-orange-100 text-orange-800 border-transparent">
          Undelivered
        </Badge>
      )
    case 'failed':
      return <Badge variant="destructive">Failed</Badge>
    default:
      return <Badge variant="secondary">{status}</Badge>
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDateTime(dateStr: string | null): string {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleString()
}

function formatCost(amount: number | null | undefined): string {
  if (amount == null) return '-'
  return `$${amount.toFixed(4)}`
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default function SmsCampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const router = useRouter()

  const [campaign, setCampaign] = useState<SmsCampaign | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [sends, setSends] = useState<SmsSendWithContact[]>([])
  const [sendsTotal, setSendsTotal] = useState(0)
  const [sendsPage, setSendsPage] = useState(1)
  const [sendsTotalPages, setSendsTotalPages] = useState(1)
  const [sendsLoading, setSendsLoading] = useState(false)
  const [statusFilter, setStatusFilter] = useState('all')
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [confirmAction, setConfirmAction] = useState<
    'send' | 'delete' | 'pause' | 'resume' | null
  >(null)
  const [actionLoading, setActionLoading] = useState(false)

  // ------- data fetching -------

  const fetchCampaign = useCallback(async () => {
    try {
      const res = await fetch(`/api/campaigns/sms/${id}`)
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
      const qp = new URLSearchParams({
        page: sendsPage.toString(),
        limit: '50',
      })
      if (statusFilter !== 'all') {
        qp.set('status', statusFilter)
      }
      const res = await fetch(`/api/campaigns/sms/${id}/sends?${qp}`)
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

  // Auto-refresh every 3 seconds while status === 'sending'
  useEffect(() => {
    if (campaign?.status !== 'sending') return
    const interval = setInterval(() => {
      fetchCampaign()
      fetchSends()
    }, 3000)
    return () => clearInterval(interval)
  }, [campaign?.status, fetchCampaign, fetchSends])

  // ------- actions -------

  async function handleAction(action: 'send' | 'delete' | 'pause' | 'resume') {
    setActionLoading(true)
    try {
      if (action === 'send' || action === 'resume') {
        const res = await fetch(`/api/campaigns/sms/${id}/send`, {
          method: 'POST',
        })
        if (!res.ok) {
          const err = await res.json()
          throw new Error(err.error || 'Failed to send')
        }
      } else if (action === 'pause') {
        const res = await fetch(`/api/campaigns/sms/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'paused' }),
        })
        if (!res.ok) throw new Error('Failed to pause')
      } else if (action === 'delete') {
        const res = await fetch(`/api/campaigns/sms/${id}`, {
          method: 'DELETE',
        })
        if (!res.ok) throw new Error('Failed to delete')
        router.push('/campaigns/sms')
        return
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

  // ------- loading skeleton -------

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-3 gap-4 md:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-64" />
      </div>
    )
  }

  // ------- not found -------

  if (!campaign) {
    return (
      <div className="space-y-4">
        <h1 className="text-3xl font-bold">Campaign Not Found</h1>
        <Link href="/campaigns/sms">
          <Button variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to SMS Campaigns
          </Button>
        </Link>
      </div>
    )
  }

  // ------- derived stats -------

  const sentProgress =
    campaign.total_recipients > 0
      ? (campaign.total_sent / campaign.total_recipients) * 100
      : 0

  const deliveryRate =
    campaign.total_sent > 0
      ? ((campaign.total_delivered / campaign.total_sent) * 100).toFixed(1)
      : '0.0'

  const failRate =
    campaign.total_sent > 0
      ? ((campaign.total_failed / campaign.total_sent) * 100).toFixed(1)
      : '0.0'

  const funnelData = [
    { name: 'Sent', value: campaign.total_sent, fill: '#3b82f6' },
    { name: 'Delivered', value: campaign.total_delivered, fill: '#22c55e' },
    { name: 'Failed', value: campaign.total_failed, fill: '#ef4444' },
  ]

  // ------- render -------

  return (
    <div className="space-y-6">
      {/* ---- Header ---- */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/campaigns/sms">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold">{campaign.name}</h1>
              <StatusBadge status={campaign.status} />
            </div>
            {campaign.from_number && (
              <p className="text-muted-foreground mt-1">
                From: {campaign.from_number}
              </p>
            )}
          </div>
        </div>

        <div className="flex gap-2">
          {campaign.status === 'draft' && (
            <>
              <Button
                variant="outline"
                onClick={() =>
                  router.push(`/campaigns/sms/new?edit=${id}`)
                }
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
                Send Now
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  setConfirmAction('delete')
                  setShowConfirmDialog(true)
                }}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
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
          {campaign.status === 'paused' && (
            <Button
              onClick={() => {
                setConfirmAction('resume')
                setShowConfirmDialog(true)
              }}
            >
              <Play className="mr-2 h-4 w-4" />
              Resume
            </Button>
          )}
        </div>
      </div>

      {/* ---- Sending Progress ---- */}
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

      {/* ---- Stats Grid ---- */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
        {/* Recipients */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <Users className="h-4 w-4" />
              <span className="text-sm font-medium">Recipients</span>
            </div>
            <div className="text-2xl font-bold">
              {campaign.total_recipients.toLocaleString()}
            </div>
          </CardContent>
        </Card>

        {/* Sent */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <MessageSquare className="h-4 w-4" />
              <span className="text-sm font-medium">Sent</span>
            </div>
            <div className="text-2xl font-bold">
              {campaign.total_sent.toLocaleString()}
            </div>
            <Progress value={sentProgress} className="mt-2" />
          </CardContent>
        </Card>

        {/* Delivered */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <CheckCircle className="h-4 w-4" />
              <span className="text-sm font-medium">Delivered</span>
            </div>
            <div className="text-2xl font-bold">
              {campaign.total_delivered.toLocaleString()}
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {deliveryRate}% delivery rate
            </p>
          </CardContent>
        </Card>

        {/* Failed */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <XCircle className="h-4 w-4" />
              <span className="text-sm font-medium">Failed</span>
            </div>
            <div className="text-2xl font-bold">
              {campaign.total_failed.toLocaleString()}
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {failRate}% fail rate
            </p>
          </CardContent>
        </Card>

        {/* Segments Used */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <Hash className="h-4 w-4" />
              <span className="text-sm font-medium">Segments Used</span>
            </div>
            <div className="text-2xl font-bold">
              {campaign.total_segments_used.toLocaleString()}
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              @ {COST_PER_SEGMENT}/seg
            </p>
          </CardContent>
        </Card>

        {/* Estimated Cost */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <DollarSign className="h-4 w-4" />
              <span className="text-sm font-medium">Estimated Cost</span>
            </div>
            <div className="text-2xl font-bold">
              ${campaign.estimated_cost.toFixed(2)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ---- Delivery Funnel Chart ---- */}
      {campaign.total_sent > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Delivery Funnel</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={funnelData}>
                  <CartesianGrid strokeDasharray="3 3" />
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

      {/* ---- Message Preview ---- */}
      <Card>
        <CardHeader>
          <CardTitle>Message Preview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border bg-muted/50 p-4 max-w-md whitespace-pre-wrap text-sm">
            {campaign.body || <span className="text-muted-foreground italic">No message body</span>}
          </div>
        </CardContent>
      </Card>

      {/* ---- Individual Sends ---- */}
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
                  <SelectItem value="queued">Queued</SelectItem>
                  <SelectItem value="sent">Sent</SelectItem>
                  <SelectItem value="delivered">Delivered</SelectItem>
                  <SelectItem value="undelivered">Undelivered</SelectItem>
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
                    <TableHead>Contact</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Segments</TableHead>
                    <TableHead>Cost</TableHead>
                    <TableHead>Sent At</TableHead>
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
                      <TableCell>{send.to_number || send.contact?.phone || '-'}</TableCell>
                      <TableCell>
                        <SendStatusBadge status={send.status} />
                      </TableCell>
                      <TableCell>{send.segments}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {formatCost(send.cost)}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {formatDateTime(send.sent_at)}
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

      {/* ---- Timestamps ---- */}
      <Card>
        <CardHeader>
          <CardTitle>Timeline</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-4 md:grid-cols-4 text-sm">
            <div>
              <dt className="text-muted-foreground">Created</dt>
              <dd className="font-medium">{formatDateTime(campaign.created_at)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Scheduled</dt>
              <dd className="font-medium">{formatDateTime(campaign.scheduled_at)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Started</dt>
              <dd className="font-medium">{formatDateTime(campaign.started_at)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Completed</dt>
              <dd className="font-medium">{formatDateTime(campaign.completed_at)}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      {/* ---- Action Confirm Dialog ---- */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {confirmAction === 'send' && 'Send Campaign?'}
              {confirmAction === 'resume' && 'Resume Campaign?'}
              {confirmAction === 'pause' && 'Pause Campaign?'}
              {confirmAction === 'delete' && 'Delete Campaign?'}
            </DialogTitle>
            <DialogDescription>
              {confirmAction === 'send' &&
                `This will start sending SMS messages to ${campaign.total_recipients.toLocaleString()} recipients. Estimated cost: $${campaign.estimated_cost.toFixed(2)}.`}
              {confirmAction === 'resume' &&
                'This will resume sending to remaining recipients.'}
              {confirmAction === 'pause' &&
                'This will pause the campaign. You can resume it later.'}
              {confirmAction === 'delete' &&
                'This will permanently delete this campaign and all associated data. This action cannot be undone.'}
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
              variant={
                confirmAction === 'delete' ? 'destructive' : 'default'
              }
            >
              {actionLoading && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {confirmAction === 'send' && 'Yes, Send'}
              {confirmAction === 'resume' && 'Yes, Resume'}
              {confirmAction === 'pause' && 'Yes, Pause'}
              {confirmAction === 'delete' && 'Yes, Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
