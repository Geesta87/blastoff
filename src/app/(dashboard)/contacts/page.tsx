'use client'

import { useWorkspace } from '@/lib/hooks/use-workspace'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'

export default function ContactsPage() {
  useWorkspace()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Contacts</h1>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Add Contact
        </Button>
      </div>
      <div className="rounded-lg border p-8 text-center text-muted-foreground">
        <p>No contacts yet. Add your first contact to get started.</p>
      </div>
    </div>
  )
}
