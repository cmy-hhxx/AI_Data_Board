import { useState, useRef, useEffect } from 'react'
import { useBoard } from '../../contexts/BoardContext'
import { api } from '../../lib/api'
import { Plus, ChevronDown, Check, FileText, Kanban, BarChart2 } from 'lucide-react'
import { cn } from '../../lib/utils'

type BoardSubView = 'kanban' | 'progress'

export function Sidebar({ boardView, onBoardViewChange }: { boardView?: BoardSubView; onBoardViewChange?: (v: BoardSubView) => void }) {
  const { state, dispatch } = useBoard()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [isAdding, setIsAdding] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const handleCreate = async () => {
    if (!newName.trim()) return
    const project = await api.projects.create({ name: newName.trim() })
    dispatch({ type: 'ADD_PROJECT', payload: project })
    dispatch({ type: 'SET_CURRENT_PROJECT', payload: project.id })
    setNewName('')
    setIsAdding(false)
    setDropdownOpen(false)
  }

  const currentProject = state.projects.find(p => p.id === state.currentProjectId)
  const isDocuments = state.view === 'documents'

  return (
    <div className="fixed top-0 left-0 right-0 z-40 flex items-center h-11 px-4 bg-white/95 backdrop-blur-xl border-b border-border/50 gap-3">

      {/* App brand / logo area */}
      <div className="flex items-center gap-2 shrink-0 mr-1">
        <div className="w-5 h-5 rounded-md bg-foreground flex items-center justify-center">
          <Kanban className="w-3 h-3 text-background" />
        </div>
        <span className="text-sm font-semibold tracking-tight text-foreground/90">Board</span>
      </div>

      {/* Divider */}
      <div className="h-4 w-px bg-border/60 shrink-0" />

      {/* View tabs: 看板 / 文档 */}
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
          <Kanban className="w-3 h-3" />
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

      {/* Divider */}
      {!isDocuments && <div className="h-4 w-px bg-border/60 shrink-0" />}

      {/* Board sub-view toggle: 看板 / 进度 */}
      {!isDocuments && onBoardViewChange && (
        <div className="flex items-center gap-0.5 shrink-0">
          {(['kanban', 'progress'] as BoardSubView[]).map((v) => (
            <button
              key={v}
              onClick={() => onBoardViewChange(v)}
              className={cn(
                'flex items-center gap-1.5 h-6 px-2 rounded text-[11px] font-medium transition-colors',
                boardView === v
                  ? 'text-foreground'
                  : 'text-muted-foreground/70 hover:text-foreground'
              )}
            >
              {v === 'progress' && <BarChart2 className="w-3 h-3" />}
              {v === 'kanban' ? '列表' : '进度'}
            </button>
          ))}
        </div>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Project selector — right side, board view only */}
      {!isDocuments && (
        <div ref={dropdownRef} className="relative shrink-0">
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className={cn(
              'flex items-center gap-1.5 h-7 px-2.5 rounded-md text-xs font-medium transition-colors border border-transparent',
              dropdownOpen ? 'bg-accent border-border/50' : 'hover:bg-accent'
            )}
          >
            {currentProject ? (
              <>
                {currentProject.color && (
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: currentProject.color }} />
                )}
                <span className="truncate max-w-[140px] text-foreground/90">{currentProject.name}</span>
              </>
            ) : (
              <span className="text-muted-foreground">选择项目</span>
            )}
            <ChevronDown className={cn('w-3 h-3 text-muted-foreground transition-transform', dropdownOpen && 'rotate-180')} />
          </button>

          {dropdownOpen && (
            <div className="absolute top-full right-0 mt-1.5 w-56 bg-white border border-border/80 rounded-xl shadow-xl overflow-hidden z-50">
              <div className="max-h-52 overflow-y-auto py-1">
                {state.projects.length === 0 && (
                  <p className="px-3 py-3 text-xs text-muted-foreground/60 text-center">暂无项目</p>
                )}
                {state.projects.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => {
                      dispatch({ type: 'SET_CURRENT_PROJECT', payload: p.id })
                      setDropdownOpen(false)
                    }}
                    className="flex items-center gap-2.5 w-full px-3 py-2 text-xs hover:bg-accent/70 transition-colors"
                  >
                    {p.color ? (
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
                    ) : (
                      <span className="w-2 h-2 rounded-full shrink-0 bg-border" />
                    )}
                    <span className="truncate flex-1 text-left font-medium">{p.name}</span>
                    {state.currentProjectId === p.id && (
                      <Check className="w-3.5 h-3.5 text-foreground shrink-0" />
                    )}
                  </button>
                ))}
              </div>
              <div className="border-t border-border/60 px-2 py-1.5">
                {isAdding ? (
                  <div className="flex items-center gap-1">
                    <input
                      autoFocus
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') setIsAdding(false) }}
                      placeholder="项目名称"
                      className="flex-1 h-6 px-2 text-xs border border-border/60 rounded-md bg-background outline-none focus:border-foreground/30"
                    />
                    <button onClick={handleCreate} className="h-6 px-2 text-xs font-medium bg-foreground text-background rounded-md">确定</button>
                    <button onClick={() => setIsAdding(false)} className="h-6 px-1.5 text-xs text-muted-foreground hover:text-foreground">✕</button>
                  </div>
                ) : (
                  <button
                    onClick={() => setIsAdding(true)}
                    className="flex items-center gap-1.5 w-full px-1.5 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors rounded-md hover:bg-accent/50"
                  >
                    <Plus className="w-3 h-3" />
                    <span>新建项目</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
