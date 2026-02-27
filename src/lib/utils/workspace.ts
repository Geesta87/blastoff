import { cookies } from 'next/headers'

const COOKIE_NAME = 'blastoff_workspace'

export async function getWorkspaceId(): Promise<string | null> {
  const cookieStore = await cookies()
  return cookieStore.get(COOKIE_NAME)?.value || null
}
