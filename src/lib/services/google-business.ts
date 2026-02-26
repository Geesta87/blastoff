const GBP_API = 'https://mybusiness.googleapis.com/v4'
const OAUTH_TOKEN_URL = 'https://oauth2.googleapis.com/token'

export async function refreshGoogleToken(
  refreshToken: string
): Promise<{ accessToken: string; expiresAt: Date }> {
  if (!process.env.GOOGLE_CLIENT_ID) {
    const expiresAt = new Date()
    expiresAt.setHours(expiresAt.getHours() + 1)
    return { accessToken: `mock_google_token_${Date.now()}`, expiresAt }
  }

  const res = await fetch(OAUTH_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID || '',
      client_secret: process.env.GOOGLE_CLIENT_SECRET || '',
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  })
  const data = await res.json()
  if (data.error) throw new Error(data.error_description || data.error)

  const expiresAt = new Date()
  expiresAt.setSeconds(expiresAt.getSeconds() + (data.expires_in || 3600))
  return { accessToken: data.access_token, expiresAt }
}

export async function publishToGBP(options: {
  locationId: string
  refreshToken: string
  message: string
  link?: string
  mediaUrl?: string
}): Promise<{ postId: string; url: string }> {
  if (!process.env.GOOGLE_CLIENT_ID) {
    const mockPostId = `mock_gbp_${Date.now()}`
    console.log('[MOCK] GBP post to location:', options.locationId)
    return { postId: mockPostId, url: `https://business.google.com/posts/${mockPostId}` }
  }

  const { accessToken } = await refreshGoogleToken(options.refreshToken)

  const localPost: Record<string, unknown> = {
    languageCode: 'en',
    summary: options.message,
    topicType: 'STANDARD',
  }

  if (options.link) {
    localPost.callToAction = { actionType: 'LEARN_MORE', url: options.link }
  }

  const res = await fetch(`${GBP_API}/${options.locationId}/localPosts`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(localPost),
  })
  const data = await res.json()
  if (data.error) throw new Error(data.error.message || 'GBP publish failed')

  const postId = (data.name || '').split('/').pop() || data.name
  return { postId, url: data.searchUrl || `https://business.google.com/posts/${postId}` }
}

export async function getGBPLocations(
  refreshToken: string
): Promise<{ locations: { id: string; name: string; address: string }[] }> {
  if (!process.env.GOOGLE_CLIENT_ID) {
    return {
      locations: [
        { id: 'locations/mock-1', name: 'Downtown Office', address: '123 Main St' },
        { id: 'locations/mock-2', name: 'Westside Branch', address: '456 Oak Ave' },
      ],
    }
  }

  const { accessToken } = await refreshGoogleToken(refreshToken)

  const accountsRes = await fetch(`${GBP_API}/accounts`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  const accountsData = await accountsRes.json()
  if (!accountsData.accounts?.length) return { locations: [] }

  const accountName = accountsData.accounts[0].name
  const locationsRes = await fetch(`${GBP_API}/${accountName}/locations`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  const locationsData = await locationsRes.json()
  if (!locationsData.locations) return { locations: [] }

  return {
    locations: locationsData.locations.map((loc: Record<string, unknown>) => ({
      id: loc.name,
      name: (loc as Record<string, string>).locationName || 'Unnamed',
      address: '',
    })),
  }
}
