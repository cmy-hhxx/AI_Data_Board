import { useBoard } from '../../contexts/BoardContext'
import { ChevronLeft, FileText, Columns3, BarChart2, LayoutDashboard, List } from 'lucide-react'
import { cn } from '../../lib/utils'
import type { BoardSubView } from '@ai-data-board/shared'

export function Sidebar({ boardView, onBoardViewChange }: { boardView?: BoardSubView; onBoardViewChange?: (v: BoardSubView) => void }) {
  const { state, dispatch } = useBoard()

  const currentProject = state.projects.find(p => p.id === state.currentProjectId)
  const isDocuments = state.view === 'documents'
  const isArchived = state.view === 'archived'
  const isInProject = !isDocuments && !isArchived && !!state.currentProjectId

  const handleBackToOverview = () => {
    if (state.currentProjectId) {
      dispatch({ type: 'SET_CURRENT_PROJECT', payload: null })
    }
    if (state.view === 'archived') {
      dispatch({ type: 'SET_VIEW', payload: 'tasks' })
    }
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-40 flex items-center h-navbar px-5 bg-card/95 backdrop-blur-xl border-b border-border gap-3">

      {/* App brand */}
      <button
        onClick={handleBackToOverview}
        className="flex items-center gap-2 shrink-0 group cursor-pointer"
        aria-label="返回总览"
      >
        <div className="w-6 h-6 rounded-lg bg-primary flex items-center justify-center shadow-sm group-hover:opacity-85 transition-opacity">
          <LayoutDashboard className="w-3.5 h-3.5 text-primary-foreground" />
        </div>
        <span className="text-sm font-semibold tracking-tight text-foreground">Board</span>
      </button>

      {isArchived ? (
        /* ── Archived mode: back button + label ── */
        <>
          <button
            onClick={handleBackToOverview}
            className="flex items-center gap-1.5 h-7 px-2.5 text-xs font-medium text-muted-foreground hover:text-foreground border border-border rounded-lg hover:bg-accent transition-colors cursor-pointer shrink-0"
            aria-label="返回总览"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            总览
          </button>
          <span className="text-sm font-semibold text-muted-foreground">已归档</span>
        </>
      ) : isInProject ? (
        /* ── Project mode: back button + project name + sub-view toggle ── */
        <>
          <button
            onClick={handleBackToOverview}
            className="flex items-center gap-1.5 h-7 px-2.5 text-xs font-medium text-muted-foreground hover:text-foreground border border-border rounded-lg hover:bg-accent transition-colors cursor-pointer shrink-0"
            aria-label="返回总览"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            总览
          </button>

          {/* Current project name */}
          <div className="flex items-center gap-2 shrink-0 min-w-0">
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: currentProject?.color ?? 'hsl(var(--muted-foreground))' }}
            />
            <span className="text-sm font-semibold text-foreground max-w-[200px] truncate">
              {currentProject?.name}
            </span>
          </div>

          {/* Sub-view toggle */}
          {onBoardViewChange && (
            <>
              <div className="h-4 w-px bg-border shrink-0 ml-1" />
              <div className="flex items-center gap-0.5 bg-muted rounded-lg p-0.5 shrink-0">
                <button
                  onClick={() => onBoardViewChange('board')}
                  className={cn(
                    'flex items-center gap-1.5 h-6 px-2.5 rounded-md text-xs font-medium transition-all duration-150 cursor-pointer',
                    boardView === 'board'
                      ? 'bg-card text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  <Columns3 className="w-3 h-3" />
                  看板
                </button>
                <button
                  onClick={() => onBoardViewChange('list')}
                  className={cn(
                    'flex items-center gap-1.5 h-6 px-2.5 rounded-md text-xs font-medium transition-all duration-150 cursor-pointer',
                    boardView === 'list'
                      ? 'bg-card text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  <List className="w-3 h-3" />
                  列表
                </button>
                <button
                  onClick={() => onBoardViewChange('progress')}
                  className={cn(
                    'flex items-center gap-1.5 h-6 px-2.5 rounded-md text-xs font-medium transition-all duration-150 cursor-pointer',
                    boardView === 'progress'
                      ? 'bg-card text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
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
        /* ── Overview / Documents mode: global view tabs ── */
        <div className="flex items-center gap-0.5 bg-muted rounded-lg p-0.5 shrink-0">
          <button
            onClick={() => dispatch({ type: 'SET_VIEW', payload: 'tasks' })}
            className={cn(
              'flex items-center gap-1.5 h-6 px-2.5 rounded-md text-xs font-medium transition-all duration-150 cursor-pointer',
              !isDocuments
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <Columns3 className="w-3 h-3" />
            看板
          </button>
          <button
            onClick={() => dispatch({ type: 'SET_VIEW', payload: 'documents' })}
            className={cn(
              'flex items-center gap-1.5 h-6 px-2.5 rounded-md text-xs font-medium transition-all duration-150 cursor-pointer',
              isDocuments
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
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
