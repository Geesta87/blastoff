'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Plus, MessageSquare } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useWorkspace } from '@/lib/hooks/use-workspace'
import type { SmsCampaign, CampaignStatus } from '@/lib/types'

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHr = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHr / 24)

  if (diffDay > 30) {
    return date.toLocaleDateString()
  }
  if (diffDay > 0) return `${diffDay}d ago`
  if (diffHr > 0) return `${diffHr}h ago`
  if (diffMin > 0) return `${diffMin}m ago`
  return 'just now'
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

export default function SmsCampaignsPage() {
  const { workspace } = useWorkspace()
  const [campaigns, setCampaigns] = useState<SmsCampaign[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!workspace) return

    async function fetchCampaigns() {
      try {
        const res = await fetch('/api/campaigns/sms')
        if (res.ok) {
          const data = await res.json()
          setCampaigns(data)
        }
      } catch (err) {
        console.error('Failed to fetch campaigns:', err)
      } finally {
        setIsLoading(false)
      }
    }

    fetchCampaigns()
  }, [workspace])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">SMS Campaigns</h1>
        <Link href="/campaigns/sms/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            New Campaign
          </Button>
        </Link>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : campaigns.length === 0 ? (
        <div className="rounded-lg border p-12 text-center">
          <MessageSquare className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-1">No SMS campaigns yet</h3>
          <p className="text-muted-foreground mb-4">
            Create your first campaign to start reaching your contacts.
          </p>
          <Link href="/campaigns/sms/new">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              New Campaign
            </Button>
          </Link>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Recipients</TableHead>
                <TableHead className="text-right">Sent</TableHead>
                <TableHead className="text-right">Delivered</TableHead>
                <TableHead className="text-right">Failed</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {campaigns.map((campaign) => {
                const deliveredRate =
                  campaign.total_sent > 0
                    ? ((campaign.total_delivered / campaign.total_sent) * 100).toFixed(1)
                    : '0.0'

                return (
                  <TableRow key={campaign.id}>
                    <TableCell>
                      <Link
                        href={`/campaigns/sms/${campaign.id}`}
                        className="font-medium hover:underline"
                      >
                        {campaign.name}
                      </Link>
                      {campaign.body && (
                        <p className="text-sm text-muted-foreground truncate max-w-[250px]">
                          {campaign.body}
                        </p>
                      )}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={campaign.status} />
                    </TableCell>
                    <TableCell className="text-right">
                      {campaign.total_recipients.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right">
                      {campaign.total_sent.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right">{deliveredRate}%</TableCell>
                    <TableCell className="text-right">
                      {campaign.total_failed.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatRelativeTime(campaign.created_at)}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
