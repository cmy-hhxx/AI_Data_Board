import { useEffect, useRef } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { useBoard } from '../contexts/BoardContext'
import { getSupabase } from '../lib/supabase'
import { api } from '../lib/api'

export function useRealtime(projectId: string | null) {
  const { dispatch } = useBoard()
  const channelRef = useRef<RealtimeChannel | null>(null)

  useEffect(() => {
    if (!projectId) return

    let cancelled = false

    getSupabase().then(supabase => {
      if (cancelled) return
      const channel = supabase.channel(`project-${projectId}`)

      channel.on('postgres_changes', { event: '*', schema: 'public' }, () => {
        if (cancelled) return
        // Simple approach: reload data on any DB change
        api.columns.list(projectId).then(columns => {
          if (!cancelled) dispatch({ type: 'SET_COLUMNS', payload: columns })
        })
        api.tasks.list(projectId).then(tasks => {
          if (!cancelled) dispatch({ type: 'SET_TASKS', payload: tasks })
        })
        api.tags.list().then(tags => {
          if (!cancelled) dispatch({ type: 'SET_TAGS', payload: tags })
        })
      })

      channel.subscribe()
      channelRef.current = channel
    })

    return () => {
      cancelled = true
      channelRef.current?.unsubscribe()
      channelRef.current = null
    }
  }, [projectId, dispatch])
}
