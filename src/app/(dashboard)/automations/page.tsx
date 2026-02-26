'use client'

import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'

export default function AutomationsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Automations</h1>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          New Automation
        </Button>
      </div>
      <div className="rounded-lg border p-8 text-center text-muted-foreground">
        No automations yet. Create your first automation to get started.
      </div>
    </div>
  )
}
