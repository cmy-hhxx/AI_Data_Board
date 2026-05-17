import { useBoard } from '../../contexts/BoardContext'
import { ChevronLeft, FileText, Columns3, BarChart2 } from 'lucide-react'
import { cn } from '../../lib/utils'
import type { BoardSubView } from '@ai-data-board/shared'

export function Sidebar({ boardView, onBoardViewChange }: { boardView?: BoardSubView; onBoardViewChange?: (v: BoardSubView) => void }) {
  const { state, dispatch } = useBoard()

  const currentProject = state.projects.find(p => p.id === state.currentProjectId)
  const isDocuments = state.view === 'documents'
  const isInProject = !isDocuments && !!state.currentProjectId

  const handleBackToOverview = () => {
    dispatch({ type: 'SET_CURRENT_PROJECT', payload: null })
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-40 flex items-center h-11 px-4 bg-white/95 backdrop-blur-xl border-b border-border/50 gap-3">

      {/* App brand / logo */}
      <div className="flex items-center gap-2 shrink-0">
        <div className="w-5 h-5 rounded-md bg-foreground flex items-center justify-center">
          <Columns3 className="w-3 h-3 text-background" />
        </div>
        <span className="text-sm font-semibold tracking-tight text-foreground/90">Board</span>
      </div>

      {/* Divider */}
      <div className="h-4 w-px bg-border/60 shrink-0" />

      {isInProject ? (
        /* ── Project mode: back button + project name + sub-view toggle ── */
        <>
          <button
            onClick={handleBackToOverview}
            className="flex items-center gap-1 h-7 px-2 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-accent/70 transition-colors shrink-0"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            总览
          </button>

          <div className="h-4 w-px bg-border/60 shrink-0" />

          {/* Current project name */}
          <div className="flex items-center gap-2 shrink-0">
            {currentProject?.color && (
              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: currentProject.color }} />
            )}
            <span className="text-sm font-medium text-foreground/90 max-w-[200px] truncate">
              {currentProject?.name}
            </span>
          </div>

          {/* Sub-view toggle */}
          {onBoardViewChange && (
            <>
              <div className="h-4 w-px bg-border/60 shrink-0" />
              <div className="flex items-center gap-0.5 shrink-0">
                <button
                  onClick={() => onBoardViewChange('board')}
                  className={cn(
                    'flex items-center gap-1.5 h-6 px-2 rounded text-[11px] font-medium transition-colors',
                    boardView === 'board' ? 'text-foreground bg-accent' : 'text-muted-foreground/70 hover:text-foreground hover:bg-accent/60'
                  )}
                >
                  列表
                </button>
                <button
                  onClick={() => onBoardViewChange('progress')}
                  className={cn(
                    'flex items-center gap-1.5 h-6 px-2 rounded text-[11px] font-medium transition-colors',
                    boardView === 'progress' ? 'text-foreground bg-accent' : 'text-muted-foreground/70 hover:text-foreground hover:bg-accent/60'
                  )}
                >
                  <BarChart2 className="w-3 h-3" />
                  进度
                </button>
              </div>
            </>
          )}
        </>
      ) : (
        /* ── Overview / Documents mode: view tabs ── */
        <div className="flex items-center gap-0.5 shrink-0">
          <button
            onClick={() => dispatch({ type: 'SET_VIEW', payload: 'tasks' })}
            className={cn(
              'flex items-center gap-1.5 h-7 px-2.5 rounded-md text-xs font-medium transition-colors',
              !isDocuments
                ? 'bg-accent text-foreground'
                : 'text-muted-foreground hover:text-foreground hover:bg-accent/60'
            )}
          >
            <Columns3 className="w-3 h-3" />
            看板
          </button>
          <button
            onClick={() => dispatch({ type: 'SET_VIEW', payload: 'documents' })}
            className={cn(
              'flex items-center gap-1.5 h-7 px-2.5 rounded-md text-xs font-medium transition-colors',
              isDocuments
                ? 'bg-accent text-foreground'
                : 'text-muted-foreground hover:text-foreground hover:bg-accent/60'
            )}
          >
            <FileText className="w-3 h-3" />
            文档
          </button>
        </div>
      )}
    </div>
  )
}
