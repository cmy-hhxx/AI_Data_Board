import { useEffect } from 'react'
import { BoardProvider, useBoard } from './contexts/BoardContext'
import { useRealtime } from './hooks/useRealtime'
import { api } from './lib/api'
import { Sidebar } from './components/layout/Sidebar'
import { BoardView } from './components/kanban/BoardView'

function AppContent() {
  const { state, dispatch } = useBoard()

  // Load projects on mount
  useEffect(() => {
    api.projects.list().then(projects => {
      dispatch({ type: 'SET_PROJECTS', payload: projects })
    })
    api.tags.list().then(tags => {
      dispatch({ type: 'SET_TAGS', payload: tags })
    })
  }, [dispatch])

  // Load columns and tasks when project changes
  useEffect(() => {
    if (!state.currentProjectId) {
      dispatch({ type: 'SET_COLUMNS', payload: [] })
      dispatch({ type: 'SET_TASKS', payload: [] })
      return
    }
    api.columns.list(state.currentProjectId).then(columns => {
      dispatch({ type: 'SET_COLUMNS', payload: columns })
    })
    api.tasks.list(state.currentProjectId).then(tasks => {
      dispatch({ type: 'SET_TASKS', payload: tasks })
    })
  }, [state.currentProjectId, dispatch])

  // Real-time sync via Supabase Realtime
  useRealtime(state.currentProjectId)

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      {state.currentProjectId ? (
        <BoardView />
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-muted-foreground text-lg">选择或创建一个项目开始使用</p>
        </div>
      )}
    </div>
  )
}

export default function App() {
  return (
    <BoardProvider>
      <AppContent />
    </BoardProvider>
  )
}
