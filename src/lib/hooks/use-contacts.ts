'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Contact } from '@/lib/types'

interface UseContactsOptions {
  search?: string
  status?: string
  tagId?: string
  page?: number
  limit?: number
}

interface UseContactsResult {
  contacts: Contact[]
  total: number
  isLoading: boolean
  error: string | null
  refetch: () => void
}

export function useContacts(workspaceId: string | undefined, options: UseContactsOptions = {}): UseContactsResult {
  const { search, status, tagId, page = 1, limit = 50 } = options
  const [contacts, setContacts] = useState<Contact[]>([])
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [trigger, setTrigger] = useState(0)

  const refetch = useCallback(() => setTrigger(t => t + 1), [])

  useEffect(() => {
    if (!workspaceId) {
      setIsLoading(false)
      return
    }

    const supabase = createClient()

    async function load() {
      setIsLoading(true)
      setError(null)

      let query = supabase
        .from('contacts')
        .select('*', { count: 'exact' })
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false })

      if (search) {
        query = query.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%`)
      }

      if (status) {
        query = query.eq('status', status)
      }

      const from = (page - 1) * limit
      query = query.range(from, from + limit - 1)

      const { data, count, error: err } = await query

      if (err) {
        setError(err.message)
      } else {
        setContacts(data as Contact[])
        setTotal(count || 0)
      }
      setIsLoading(false)
    }

    load()
  }, [workspaceId, search, status, tagId, page, limit, trigger])

  return { contacts, total, isLoading, error, refetch }
}
