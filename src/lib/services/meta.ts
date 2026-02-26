const META_GRAPH_API = 'https://graph.facebook.com/v19.0'

interface SocialPostResult {
  postId: string
  url: string
}

interface PostEngagement {
  likes: number
  comments: number
  shares: number
  reach: number
}

export async function publishToFacebook(options: {
  pageId: string
  accessToken: string
  message: string
  link?: string
  mediaUrls?: string[]
}): Promise<SocialPostResult> {
  if (!process.env.META_APP_ID) {
    const mockPostId = `mock_fb_${Date.now()}`
    console.log('[MOCK] Facebook post to page:', options.pageId)
    return { postId: mockPostId, url: `https://facebook.com/${options.pageId}/posts/${mockPostId}` }
  }

  const res = await fetch(`${META_GRAPH_API}/${options.pageId}/feed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      access_token: options.accessToken,
      message: options.message,
      link: options.link || undefined,
    }),
  })
  const data = await res.json()
  if (data.error) throw new Error(data.error.message || 'Facebook API error')
  return { postId: data.id, url: `https://facebook.com/${data.id}` }
}

export async function publishToInstagram(options: {
  accountId: string
  accessToken: string
  message: string
  mediaUrl: string
}): Promise<SocialPostResult> {
  if (!process.env.META_APP_ID) {
    const mockPostId = `mock_ig_${Date.now()}`
    console.log('[MOCK] Instagram post to account:', options.accountId)
    return { postId: mockPostId, url: `https://instagram.com/p/${mockPostId}` }
  }

  // Create container
  const containerRes = await fetch(`${META_GRAPH_API}/${options.accountId}/media`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      image_url: options.mediaUrl,
      caption: options.message,
      access_token: options.accessToken,
    }),
  })
  const containerData = await containerRes.json()
  if (containerData.error) throw new Error(containerData.error.message)

  // Publish
  const publishRes = await fetch(`${META_GRAPH_API}/${options.accountId}/media_publish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      creation_id: containerData.id,
      access_token: options.accessToken,
    }),
  })
  const publishData = await publishRes.json()
  if (publishData.error) throw new Error(publishData.error.message)

  return { postId: publishData.id, url: `https://instagram.com/p/${publishData.id}` }
}

export async function getPostEngagement(
  postId: string,
  accessToken: string
): Promise<PostEngagement> {
  if (!process.env.META_APP_ID) {
    return {
      likes: Math.floor(Math.random() * 500) + 10,
      comments: Math.floor(Math.random() * 50) + 2,
      shares: Math.floor(Math.random() * 100) + 1,
      reach: Math.floor(Math.random() * 5000) + 100,
    }
  }

  const res = await fetch(
    `${META_GRAPH_API}/${postId}?fields=likes.summary(true),comments.summary(true),shares&access_token=${accessToken}`
  )
  const data = await res.json()
  return {
    likes: data.likes?.summary?.total_count || 0,
    comments: data.comments?.summary?.total_count || 0,
    shares: data.shares?.count || 0,
    reach: 0,
  }
}

export async function refreshMetaToken(
  currentToken: string
): Promise<{ accessToken: string; expiresAt: Date }> {
  if (!process.env.META_APP_ID) {
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 60)
    return { accessToken: `mock_refreshed_token_${Date.now()}`, expiresAt }
  }

  const res = await fetch(
    `${META_GRAPH_API}/oauth/access_token?grant_type=fb_exchange_token&client_id=${process.env.META_APP_ID}&client_secret=${process.env.META_APP_SECRET}&fb_exchange_token=${currentToken}`
  )
  const data = await res.json()
  if (data.error) throw new Error(data.error.message)

  const expiresAt = new Date()
  expiresAt.setSeconds(expiresAt.getSeconds() + (data.expires_in || 5184000))
  return { accessToken: data.access_token, expiresAt }
}
