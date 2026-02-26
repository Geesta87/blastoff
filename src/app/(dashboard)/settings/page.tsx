'use client'

import { useWorkspace } from '@/lib/hooks/use-workspace'

export default function SettingsPage() {
  const { workspace } = useWorkspace()

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Settings</h1>
      <div className="rounded-lg border p-6">
        <h2 className="text-lg font-semibold mb-4">Workspace</h2>
        <p className="text-muted-foreground">
          {workspace ? `Current workspace: ${workspace.name}` : 'No workspace selected'}
        </p>
      </div>
      <div className="rounded-lg border p-6">
        <h2 className="text-lg font-semibold mb-4">Integrations</h2>
        <p className="text-muted-foreground">
          Integration settings coming soon. Connect Twilio, SendGrid, Meta, and Google Business here.
        </p>
      </div>
    </div>
  )
}
