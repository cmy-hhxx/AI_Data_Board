import { useState } from 'react'
import { useBoard } from '../../contexts/BoardContext'
import { api } from '../../lib/api'
import { Plus, Trash2 } from 'lucide-react'
import { cn } from '../../lib/utils'

export function Sidebar() {
  const { state, dispatch } = useBoard()
  const [newName, setNewName] = useState('')
  const [isAdding, setIsAdding] = useState(false)

  const handleCreate = async () => {
    if (!newName.trim()) return
    const project = await api.projects.create({ name: newName.trim() })
    dispatch({ type: 'ADD_PROJECT', payload: project })
    dispatch({ type: 'SET_CURRENT_PROJECT', payload: project.id })
    setNewName('')
    setIsAdding(false)
  }

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    await api.projects.delete(id)
    dispatch({ type: 'REMOVE_PROJECT', payload: id })
  }

  const handleSelect = (id: string) => {
    dispatch({ type: 'SET_CURRENT_PROJECT', payload: id })
  }

  return (
    <>
      {/* Spacer — same height as the fixed nav */}
      <div className="h-[72px]" />

      <nav className="fixed top-4 left-1/2 z-40 -translate-x-1/2 flex items-center gap-1 h-11 px-1.5 bg-white/85 backdrop-blur-xl border border-border/80 rounded-full shadow-[0_4px_20px_rgba(0,0,0,.06)]">
        {state.projects.map((p) => (
          <button
            key={p.id}
            onClick={() => handleSelect(p.id)}
            className={cn(
              'group/item relative flex items-center gap-2 h-8 px-3 rounded-full text-sm font-medium whitespace-nowrap transition-all',
              state.currentProjectId === p.id
                ? 'bg-foreground text-background'
                : 'text-muted-foreground hover:text-foreground hover:bg-accent'
            )}
          >
            {p.color && (
              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
            )}
            <span className="truncate max-w-[120px]">{p.name}</span>
            <button
              onClick={(e) => handleDelete(p.id, e)}
              className={cn(
                'p-0.5 rounded-full opacity-0 group-hover/item:opacity-100 transition-opacity',
                state.currentProjectId === p.id
                  ? 'hover:bg-white/20 text-background/70 hover:text-background'
                  : 'hover:bg-accent-foreground/10 hover:text-foreground'
              )}
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </button>
        ))}

        {isAdding ? (
          <div className="flex items-center gap-1 pl-2">
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') setIsAdding(false) }}
              placeholder="项目名"
              className="w-28 h-7 px-2 text-xs border rounded-md bg-background outline-none"
            />
            <button onClick={handleCreate} className="h-7 px-2 text-xs font-medium bg-foreground text-background rounded-md">确定</button>
            <button onClick={() => setIsAdding(false)} className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground">取消</button>
          </div>
        ) : (
          <button
            onClick={() => setIsAdding(true)}
            className="flex items-center justify-center w-8 h-8 rounded-full text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            <Plus className="w-4 h-4" />
          </button>
        )}
      </nav>

      {/* Show project name as page title when a project is selected */}
      {state.currentProjectId && (
        <div className="fixed top-[72px] left-1/2 -translate-x-1/2 z-30">
          <h1 className="text-xs font-medium text-muted-foreground tracking-wide uppercase">
            {state.projects.find(p => p.id === state.currentProjectId)?.name}
          </h1>
        </div>
      )}
    </>
  )
}
