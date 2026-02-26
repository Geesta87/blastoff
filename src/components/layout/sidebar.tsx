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
} from 'lucide-react'

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Contacts', href: '/contacts', icon: Users },
  { name: 'Email Campaigns', href: '/campaigns/email', icon: Mail },
  { name: 'SMS Campaigns', href: '/campaigns/sms', icon: MessageSquare },
  { name: 'Automations', href: '/automations', icon: Zap },
  { name: 'Social', href: '/social', icon: Share2 },
  { name: 'Analytics', href: '/analytics', icon: BarChart3 },
  { name: 'Settings', href: '/settings', icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 bg-gray-950 text-white">
      <div className="flex h-16 items-center px-6 border-b border-gray-800">
        <Link href="/dashboard" className="text-xl font-bold tracking-tight">
          Blastoff
        </Link>
      </div>

      <div className="px-3 py-4">
        <WorkspaceSwitcher />
      </div>

      <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
        {navigation.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-gray-800 text-white'
                  : 'text-gray-400 hover:bg-gray-800/50 hover:text-white'
              )}
            >
              <item.icon className="h-5 w-5 shrink-0" />
              {item.name}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
