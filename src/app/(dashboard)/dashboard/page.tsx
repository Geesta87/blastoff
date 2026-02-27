'use client'

import { useWorkspace } from '@/lib/hooks/use-workspace'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Users, Mail, MessageSquare, Zap, UserPlus, Rocket, Activity } from 'lucide-react'

interface DashboardStats {
  totalContacts: number
  emailCampaigns: number
  smsCampaigns: number
  automations: number
}

export default function DashboardPage() {
  const { workspace, isLoading } = useWorkspace()
  const [stats, setStats] = useState<DashboardStats>({
    totalContacts: 0,
    emailCampaigns: 0,
    smsCampaigns: 0,
    automations: 0,
  })

  useEffect(() => {
    if (!workspace) return
    const supabase = createClient()
    async function fetchStats() {
      const [contacts, emails, sms, autos] = await Promise.all([
        supabase.from('contacts').select('id', { count: 'exact', head: true }).eq('workspace_id', workspace!.id),
        supabase.from('email_campaigns').select('id', { count: 'exact', head: true }).eq('workspace_id', workspace!.id),
        supabase.from('sms_campaigns').select('id', { count: 'exact', head: true }).eq('workspace_id', workspace!.id),
        supabase.from('automations').select('id', { count: 'exact', head: true }).eq('workspace_id', workspace!.id),
      ])
      setStats({
        totalContacts: contacts.count || 0,
        emailCampaigns: emails.count || 0,
        smsCampaigns: sms.count || 0,
        automations: autos.count || 0,
      })
    }
    fetchStats()
  }, [workspace])

  if (isLoading) return <DashboardSkeleton />
  if (!workspace) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <p className="text-muted-foreground">No workspace found. Please create one.</p>
      </div>
    )
  }

  const statCards = [
    { label: 'Total Contacts', value: stats.totalContacts.toLocaleString(), icon: Users, change: null },
    { label: 'Email Campaigns', value: stats.emailCampaigns.toString(), icon: Mail, accent: true },
    { label: 'SMS Campaigns', value: stats.smsCampaigns.toString(), icon: MessageSquare, change: null },
    { label: 'Automations', value: stats.automations.toString(), icon: Zap, change: null },
  ]

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-bold">Dashboard Overview</h1>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat) => (
          <div
            key={stat.label}
            className={`bg-card p-6 rounded-xl border border-slate-800 flex flex-col gap-1 shadow-sm ${
              stat.accent ? 'border-l-4 border-l-primary' : ''
            }`}
          >
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-slate-400">{stat.label}</p>
              <stat.icon className="h-4 w-4 text-slate-500" />
            </div>
            <h3 className={`text-2xl font-bold ${stat.accent ? 'text-primary' : ''}`}>
              {stat.value}
            </h3>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Email Performance Chart Placeholder */}
        <div className="bg-card p-6 rounded-xl border border-slate-800 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h4 className="text-base font-bold">Email Performance</h4>
              <p className="text-xs text-slate-500">Last 30 days summary</p>
            </div>
            <div className="flex gap-4 text-xs">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full bg-primary" />
                <span className="text-slate-400">Opens</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full bg-purple-400" />
                <span className="text-slate-400">Clicks</span>
              </div>
            </div>
          </div>
          <div className="h-48 flex items-center justify-center text-slate-600 text-sm">
            <div className="text-center">
              <Activity className="h-8 w-8 mx-auto mb-2 text-slate-600" />
              <p>Send your first campaign to see performance data</p>
            </div>
          </div>
        </div>

        {/* Campaign Activity Chart Placeholder */}
        <div className="bg-card p-6 rounded-xl border border-slate-800 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h4 className="text-base font-bold">Campaign Activity</h4>
              <p className="text-xs text-slate-500">Weekly engagement metrics</p>
            </div>
          </div>
          <div className="h-48 flex items-end justify-between gap-3 px-2">
            {['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'].map((day) => (
              <div key={day} className="flex flex-col items-center gap-3 w-full">
                <div
                  className="w-full bg-primary/20 hover:bg-primary transition-all rounded-t-lg"
                  style={{ height: `${Math.max(20, Math.random() * 100)}%` }}
                />
                <span className="text-[10px] text-slate-500 font-bold">{day}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="flex flex-col gap-4">
        <h3 className="text-lg font-bold">Recent Activity</h3>
        <div className="bg-card rounded-xl border border-slate-800 overflow-hidden">
          <div className="divide-y divide-slate-800">
            <ActivityItem
              icon={<UserPlus className="h-5 w-5" />}
              iconBg="bg-emerald-500/10 text-emerald-500"
              title="Get started"
              description="Import your contacts or add them manually"
              time="Now"
            />
            <ActivityItem
              icon={<Rocket className="h-5 w-5" />}
              iconBg="bg-primary/10 text-primary"
              title="Create your first campaign"
              description="Send an email or SMS to your contacts"
              time="Next step"
            />
            <ActivityItem
              icon={<Zap className="h-5 w-5" />}
              iconBg="bg-purple-500/10 text-purple-500"
              title="Set up automations"
              description="Automate your marketing workflows"
              time="Coming up"
            />
          </div>
        </div>
      </div>
    </div>
  )
}

function ActivityItem({
  icon,
  iconBg,
  title,
  description,
  time,
}: {
  icon: React.ReactNode
  iconBg: string
  title: string
  description: string
  time: string
}) {
  return (
    <div className="p-4 flex items-center justify-between hover:bg-slate-800/50 transition-colors">
      <div className="flex items-center gap-4">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${iconBg}`}>
          {icon}
        </div>
        <div>
          <p className="text-sm font-semibold">{title}</p>
          <p className="text-xs text-slate-500">{description}</p>
        </div>
      </div>
      <span className="text-xs text-slate-500 font-medium">{time}</span>
    </div>
  )
}

function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-8">
      <div className="h-8 w-48 bg-slate-800 rounded animate-pulse" />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-card p-6 rounded-xl border border-slate-800">
            <div className="h-4 w-24 bg-slate-700 rounded animate-pulse mb-3" />
            <div className="h-8 w-16 bg-slate-700 rounded animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  )
}
