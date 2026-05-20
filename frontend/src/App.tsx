import { useEffect, useState } from 'react'
import { BoardProvider, useBoard } from './contexts/BoardContext'
import { useRealtime } from './hooks/useRealtime'
import { api } from './lib/api'
import { Sidebar } from './components/layout/Sidebar'
import { BoardView } from './components/board/BoardView'
import { DocumentView } from './components/board/DocumentView'
import { OverviewView } from './components/board/OverviewView'
import { ArchivedView } from './components/board/ArchivedView'
import { ErrorBoundary } from './components/ErrorBoundary'
import type { BoardSubView } from '@ai-data-board/shared'

function AppContent() {
  const { state, dispatch } = useBoard()
  const [boardView, setBoardView] = useState<BoardSubView>('board')

  // Load projects on mount
  useEffect(() => {
    api.projects.list().then(projects => {
      dispatch({ type: 'SET_PROJECTS', payload: projects })
    })
  }, [dispatch])

  // Load columns and tasks when project changes
  useEffect(() => {
    if (!state.currentProjectId) {
      dispatch({ type: 'SET_COLUMNS', payload: [] })
      dispatch({ type: 'SET_TASKS', payload: [], source: 'force' })
      return
    }
    api.columns.list(state.currentProjectId).then(columns => {
      dispatch({ type: 'SET_COLUMNS', payload: columns })
    })
    api.tasks.list(state.currentProjectId).then(tasks => {
      dispatch({ type: 'SET_TASKS', payload: tasks, source: 'remote' })
    })
  }, [state.currentProjectId, dispatch])

  // Real-time sync via Supabase Realtime
  useRealtime(state.currentProjectId)

  const renderView = () => {
    if (state.view === 'archived') {
      return <ArchivedView />
    }
    if (state.view === 'documents') {
      return <DocumentView />
    }
    if (!state.currentProjectId) {
      return <OverviewView />
    }
    return <BoardView boardView={boardView} />
  }

  return (
    <div className="min-h-screen pt-navbar bg-background">
      <Sidebar boardView={boardView} onBoardViewChange={setBoardView} />
      <ErrorBoundary>
        {renderView()}
      </ErrorBoundary>
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
