'use client'

import { useParams } from 'next/navigation'

export default function ContactDetailPage() {
  const params = useParams()

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Contact Details</h1>
      <p className="text-muted-foreground">Contact ID: {params.id}</p>
      <div className="rounded-lg border p-8 text-center text-muted-foreground">
        Contact detail view coming soon.
      </div>
    </div>
  )
}
