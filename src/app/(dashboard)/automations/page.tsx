'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { useWorkspace } from '@/lib/hooks/use-workspace'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Plus, Zap, Users } from 'lucide-react'

interface Automation {
  id: string
  name: string
  status: string
  trigger_type: string
  steps: Record<string, unknown>[]
  total_runs: number
  active_runs: number
  created_at: string
  updated_at: string
}

const TRIGGER_LABELS: Record<string, string> = {
  contact_created: 'Contact Created',
  tag_added: 'Tag Added',
  tag_removed: 'Tag Removed',
  email_opened: 'Email Opened',
  email_clicked: 'Email Clicked',
  sms_delivered: 'SMS Delivered',
  sms_replied: 'SMS Replied',
  form_submitted: 'Form Submitted',
  webhook_received: 'Webhook',
  manual: 'Manual',
}

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'active':
      return <Badge className="bg-green-100 text-green-800 border-transparent">Active</Badge>
    case 'draft':
      return <Badge variant="secondary">Draft</Badge>
    case 'paused':
      return <Badge className="bg-orange-100 text-orange-800 border-transparent">Paused</Badge>
    default:
      return <Badge variant="outline">{status}</Badge>
  }
}

export default function AutomationsPage() {
  const { workspace } = useWorkspace()
  const [automations, setAutomations] = useState<Automation[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const fetchAutomations = useCallback(async () => {
    try {
      const res = await fetch('/api/automations')
      if (res.ok) {
        const data = await res.json()
        setAutomations(data.automations || [])
      }
    } catch (err) {
      console.error('Failed to fetch automations:', err)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!workspace) return
    fetchAutomations()
  }, [workspace, fetchAutomations])

  async function toggleStatus(automation: Automation) {
    const newStatus = automation.status === 'active' ? 'paused' : 'active'
    try {
      const res = await fetch(`/api/automations/${automation.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      if (res.ok) {
        setAutomations((prev) =>
          prev.map((a) => (a.id === automation.id ? { ...a, status: newStatus } : a))
        )
      }
    } catch (err) {
      console.error('Failed to toggle automation:', err)
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-9 w-48" />
          <Skeleton className="h-10 w-40" />
        </div>
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Automations</h1>
        <Link href="/automations/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            New Automation
          </Button>
        </Link>
      </div>

      {automations.length === 0 ? (
        <div className="rounded-lg border p-12 text-center">
          <Zap className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-1">No automations yet</h3>
          <p className="text-muted-foreground mb-4">
            Create your first automation to start engaging contacts automatically.
          </p>
          <Link href="/automations/new">
            <Button>Create Automation</Button>
          </Link>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Trigger</TableHead>
              <TableHead>Steps</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Total Runs</TableHead>
              <TableHead className="text-right">Active</TableHead>
              <TableHead className="text-right">Enabled</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {automations.map((automation) => (
              <TableRow key={automation.id}>
                <TableCell>
                  <Link
                    href={`/automations/${automation.id}`}
                    className="font-medium hover:underline"
                  >
                    {automation.name}
                  </Link>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">
                    {TRIGGER_LABELS[automation.trigger_type] || automation.trigger_type}
                  </Badge>
                </TableCell>
                <TableCell>{automation.steps?.length || 0}</TableCell>
                <TableCell>
                  <StatusBadge status={automation.status} />
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Users className="h-3.5 w-3.5 text-muted-foreground" />
                    {automation.total_runs.toLocaleString()}
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  {automation.active_runs > 0 ? (
                    <Badge className="bg-blue-100 text-blue-800 border-transparent">
                      {automation.active_runs}
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground">0</span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <Switch
                    checked={automation.status === 'active'}
                    onCheckedChange={() => toggleStatus(automation)}
                    disabled={automation.status === 'draft' && (!automation.steps?.length)}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  )
}
