'use client'

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Workspace } from '@/lib/types'

interface WorkspaceContextValue {
  workspace: Workspace | null
  workspaces: Workspace[]
  switchWorkspace: (id: string) => void
  isLoading: boolean
}

const WorkspaceContext = createContext<WorkspaceContextValue>({
  workspace: null,
  workspaces: [],
  switchWorkspace: () => {},
  isLoading: true,
})

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [workspace, setWorkspace] = useState<Workspace | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()

    async function load() {
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

      const savedId = typeof window !== 'undefined'
        ? localStorage.getItem('blastoff_workspace_id')
        : null

      const active = list.find(w => w.id === savedId) || list[0] || null
      setWorkspace(active)
      if (active) localStorage.setItem('blastoff_workspace_id', active.id)
      setIsLoading(false)
    }

    load()
  }, [])

  const switchWorkspace = useCallback((id: string) => {
    const ws = workspaces.find(w => w.id === id)
    if (ws) {
      setWorkspace(ws)
      localStorage.setItem('blastoff_workspace_id', id)
    }
  }, [workspaces])

  return (
    <WorkspaceContext.Provider value={{ workspace, workspaces, switchWorkspace, isLoading }}>
      {children}
    </WorkspaceContext.Provider>
  )
}

export function useWorkspace() {
  return useContext(WorkspaceContext)
}
