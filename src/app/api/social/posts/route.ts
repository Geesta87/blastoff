import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { enqueueJob } from '@/lib/services/job-queue'

export async function GET(request: NextRequest) {
  const supabase = await createServerClient()
  const { searchParams } = new URL(request.url)
  const workspaceId = searchParams.get('workspace_id')

  if (!workspaceId) {
    return NextResponse.json({ error: 'workspace_id required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('social_posts')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  const supabase = await createServerClient()
  const body = await request.json()

  const { data: post, error } = await supabase
    .from('social_posts')
    .insert(body)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // If scheduled for now or in the past, enqueue immediately
  if (post.status === 'scheduled' && post.scheduled_at) {
    const scheduledTime = new Date(post.scheduled_at)
    await enqueueJob({
      workspaceId: post.workspace_id,
      type: 'social_post_publish',
      payload: { postId: post.id, workspaceId: post.workspace_id },
      executeAt: scheduledTime,
      priority: 3,
      idempotencyKey: `social_publish_${post.id}`,
    })
  }

  return NextResponse.json(post, { status: 201 })
}
