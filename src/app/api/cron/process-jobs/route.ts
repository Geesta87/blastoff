import { NextRequest, NextResponse } from 'next/server'
import { processJobs } from '@/lib/services/job-queue'
import { processEvents } from '@/lib/services/events'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 1. Process events first (creates automation runs → enqueues step jobs)
  const eventResult = await processEvents(supabaseAdmin)

  // 2. Then process jobs (executes automation steps + campaign sends)
  const jobResult = await processJobs()

  return NextResponse.json({
    events: eventResult,
    jobs: jobResult,
  })
}
