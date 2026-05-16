import { useState } from 'react'
import { useBoard } from '../../contexts/BoardContext'
import { api } from '../../lib/api'
import { Plus, Trash2, FolderKanban } from 'lucide-react'
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

  const handleDelete = async (id: string) => {
    await api.projects.delete(id)
    dispatch({ type: 'REMOVE_PROJECT', payload: id })
  }

  const handleSelect = (id: string) => {
    dispatch({ type: 'SET_CURRENT_PROJECT', payload: id })
  }

  return (
    <aside className="w-56 border-r bg-muted/30 flex flex-col h-screen">
      <div className="p-4 border-b">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <FolderKanban className="w-4 h-4" />
          项目列表
        </h2>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {state.projects.map((p) => (
          <button
            key={p.id}
            onClick={() => handleSelect(p.id)}
            className={cn(
              'w-full text-left px-3 py-2 rounded-md text-sm flex items-center justify-between group hover:bg-accent transition-colors',
              state.currentProjectId === p.id && 'bg-accent font-medium'
            )}
          >
            <span className="flex items-center gap-2 truncate">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: p.color || '#6b7280' }} />
              <span className="truncate">{p.name}</span>
            </span>
            <button
              onClick={(e) => { e.stopPropagation(); handleDelete(p.id) }}
              className="opacity-0 group-hover:opacity-100 hover:text-destructive transition-all shrink-0"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </button>
        ))}
      </div>
      <div className="p-3 border-t">
        {isAdding ? (
          <div className="space-y-2">
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') setIsAdding(false) }}
              placeholder="项目名称"
              className="w-full px-2 py-1.5 text-sm border rounded-md bg-background"
            />
            <div className="flex gap-1">
              <button onClick={handleCreate} className="text-xs px-2 py-1 bg-primary text-primary-foreground rounded-md">确定</button>
              <button onClick={() => setIsAdding(false)} className="text-xs px-2 py-1 bg-muted rounded-md">取消</button>
            </div>
          </div>
        ) : (
          <button onClick={() => setIsAdding(true)} className="w-full text-sm flex items-center gap-1 px-3 py-2 hover:bg-accent rounded-md transition-colors">
            <Plus className="w-4 h-4" /> 新建项目
          </button>
        )}
      </div>
    </aside>
  )
}
