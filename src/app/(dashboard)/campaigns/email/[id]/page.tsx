'use client'

import { useParams } from 'next/navigation'

export default function EmailCampaignDetailPage() {
  const params = useParams()

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Email Campaign</h1>
      <p className="text-muted-foreground">Campaign ID: {params.id}</p>
      <div className="rounded-lg border p-8 text-center text-muted-foreground">
        Email campaign editor coming soon.
      </div>
    </div>
  )
}
