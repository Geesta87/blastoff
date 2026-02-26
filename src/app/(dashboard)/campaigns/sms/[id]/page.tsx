'use client'

import { useParams } from 'next/navigation'

export default function SmsCampaignDetailPage() {
  const params = useParams()

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">SMS Campaign</h1>
      <p className="text-muted-foreground">Campaign ID: {params.id}</p>
      <div className="rounded-lg border p-8 text-center text-muted-foreground">
        SMS campaign editor coming soon.
      </div>
    </div>
  )
}
