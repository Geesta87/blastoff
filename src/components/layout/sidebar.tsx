'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { WorkspaceSwitcher } from './workspace-switcher'
import {
  LayoutDashboard,
  Users,
  Mail,
  MessageSquare,
  Zap,
  Share2,
  BarChart3,
  Settings,
  Rocket,
} from 'lucide-react'

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Contacts', href: '/contacts', icon: Users },
  { name: 'Email Campaigns', href: '/campaigns/email', icon: Mail },
  { name: 'SMS Campaigns', href: '/campaigns/sms', icon: MessageSquare },
  { name: 'Automations', href: '/automations', icon: Zap },
  { name: 'Templates', href: '/templates/email', icon: Share2 },
  { name: 'Analytics', href: '/analytics', icon: BarChart3 },
  { name: 'Settings', href: '/settings', icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 bg-sidebar border-r border-slate-800">
      <div className="flex flex-col gap-6 p-4 h-full">
        {/* Brand */}
        <div className="flex items-center gap-3 px-2 pt-2">
          <div className="w-9 h-9 bg-primary rounded-lg flex items-center justify-center text-white shadow-lg shadow-primary/20">
            <Rocket className="h-5 w-5" />
          </div>
          <div className="flex flex-col">
            <span className="text-lg font-bold tracking-tight text-white">Blastoff</span>
            <span className="text-[11px] text-slate-400">Marketing Automation</span>
          </div>
        </div>

        {/* Workspace Switcher */}
        <WorkspaceSwitcher />

        {/* Navigation */}
        <nav className="flex-1 flex flex-col gap-1">
          {navigation.map((item) => {
            const isActive =
              pathname === item.href || pathname.startsWith(item.href + '/')
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary/20 text-primary border border-primary/20'
                    : 'text-slate-400 hover:bg-slate-800/50 hover:text-white'
                )}
              >
                <item.icon className="h-5 w-5 shrink-0" />
                {item.name}
              </Link>
            )
          })}
        </nav>

        {/* Bottom Section */}
        <div className="mt-auto">
          <Link
            href="/campaigns/email/new"
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-primary hover:bg-primary/90 text-white rounded-lg font-semibold text-sm transition-all shadow-lg shadow-primary/20"
          >
            <Mail className="h-4 w-4" />
            New Campaign
          </Link>
        </div>
      </div>
    </aside>
  )
}
