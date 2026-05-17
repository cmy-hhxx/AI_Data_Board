import { useEffect, useState } from 'react'
import { BoardProvider, useBoard } from './contexts/BoardContext'
import { useRealtime } from './hooks/useRealtime'
import { api } from './lib/api'
import { Sidebar } from './components/layout/Sidebar'
import { BoardView } from './components/kanban/BoardView'
import { DocumentView } from './components/kanban/DocumentView'
import { OverviewView } from './components/kanban/OverviewView'

type BoardSubView = 'kanban' | 'progress'

function AppContent() {
  const { state, dispatch } = useBoard()
  const [boardView, setBoardView] = useState<BoardSubView>('kanban')

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
    if (state.view === 'documents') {
      return <DocumentView />
    }
    if (!state.currentProjectId) {
      return <OverviewView />
    }
    return <BoardView boardView={boardView} />
  }

  return (
    <div className="min-h-screen pt-11">
      <Sidebar boardView={boardView} onBoardViewChange={setBoardView} />
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
