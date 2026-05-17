import { useEffect } from 'react'
import { BoardProvider, useBoard } from './contexts/BoardContext'
import { useRealtime } from './hooks/useRealtime'
import { api } from './lib/api'
import { Sidebar } from './components/layout/Sidebar'
import { BoardView } from './components/kanban/BoardView'
import { ProgressView } from './components/kanban/ProgressView'
import { DocumentView } from './components/kanban/DocumentView'

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

  const renderView = () => {
    if (state.view === 'progress') {
      return <ProgressView />
    }
    if (state.view === 'documents') {
      return <DocumentView />
    }
    if (!state.currentProjectId) {
      return (
        <div className="flex items-center justify-center" style={{ height: 'calc(100vh - 120px)' }}>
          <div className="text-center">
            <p className="text-sm font-medium text-muted-foreground/60">选择一个项目或新建一个开始使用</p>
          </div>
        </div>
      )
    }
    return <BoardView />
  }

  return (
    <div className="min-h-screen">
      <Sidebar />
      {renderView()}
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
