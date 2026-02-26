'use client'

import { useParams } from 'next/navigation'

export default function AutomationDetailPage() {
  const params = useParams()

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Automation Builder</h1>
      <p className="text-muted-foreground">Automation ID: {params.id}</p>
      <div className="rounded-lg border p-8 text-center text-muted-foreground">
        Visual automation builder coming soon.
      </div>
    </div>
  )
}
