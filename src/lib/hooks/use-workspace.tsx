'use client'

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Workspace } from '@/lib/types'

const COOKIE_NAME = 'blastoff_workspace'

function setWorkspaceCookie(id: string) {
  document.cookie = `${COOKIE_NAME}=${id};path=/;max-age=${60 * 60 * 24 * 365};samesite=lax`
}

function getWorkspaceCookie(): string | null {
  if (typeof document === 'undefined') return null
  const match = document.cookie.match(new RegExp(`(?:^|; )${COOKIE_NAME}=([^;]*)`))
  return match ? match[1] : null
}

interface WorkspaceContextValue {
  workspace: Workspace | null
  workspaces: Workspace[]
  switchWorkspace: (id: string) => void
  refreshWorkspaces: () => Promise<void>
  isLoading: boolean
}

const WorkspaceContext = createContext<WorkspaceContextValue>({
  workspace: null,
  workspaces: [],
  switchWorkspace: () => {},
  refreshWorkspaces: async () => {},
  isLoading: true,
})

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [workspace, setWorkspace] = useState<Workspace | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const loadWorkspaces = useCallback(async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setIsLoading(false)
      return
    }

    const { data: members } = await supabase
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', user.id)

    if (!members?.length) {
      setIsLoading(false)
      return
    }

    const ids = members.map(m => m.workspace_id)
    const { data: ws } = await supabase
      .from('workspaces')
      .select('*')
      .in('id', ids)
      .order('created_at')

    const list = (ws || []) as Workspace[]
    setWorkspaces(list)

    const savedId = getWorkspaceCookie() || (typeof window !== 'undefined' ? localStorage.getItem('blastoff_workspace_id') : null)
    const active = list.find(w => w.id === savedId) || list[0] || null
    setWorkspace(active)
    if (active) {
      setWorkspaceCookie(active.id)
      localStorage.setItem('blastoff_workspace_id', active.id)
    }
    setIsLoading(false)
  }, [])

  useEffect(() => {
    loadWorkspaces()
  }, [loadWorkspaces])

  const switchWorkspace = useCallback((id: string) => {
    const ws = workspaces.find(w => w.id === id)
    if (ws) {
      setWorkspace(ws)
      setWorkspaceCookie(ws.id)
      localStorage.setItem('blastoff_workspace_id', ws.id)
      window.location.reload()
    }
  }, [workspaces])

  const refreshWorkspaces = useCallback(async () => {
    await loadWorkspaces()
  }, [loadWorkspaces])

  return (
    <WorkspaceContext.Provider value={{ workspace, workspaces, switchWorkspace, refreshWorkspaces, isLoading }}>
      {children}
    </WorkspaceContext.Provider>
  )
}

export function useWorkspace() {
  return useContext(WorkspaceContext)
}
