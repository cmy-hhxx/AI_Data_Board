import { useState, useCallback } from 'react'
import { DndContext, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { useBoard } from '../../contexts/BoardContext'
import { api } from '../../lib/api'
import { BoardColumn } from './BoardColumn'
import { ProgressView } from './ProgressView'
import { Plus } from 'lucide-react'

type BoardSubView = 'kanban' | 'progress'

interface BoardViewProps {
  boardView: BoardSubView
}

export function BoardView({ boardView }: BoardViewProps) {
  const { state, dispatch } = useBoard()
  const [addingColumn, setAddingColumn] = useState(false)
  const [newColumnName, setNewColumnName] = useState('')

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  )

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event
    if (!over) return

    const taskId = active.id as string
    const overId = over.id as string
    const activeData = active.data.current

    let targetColumnId: string
    if (over.data.current?.type === 'column') {
      targetColumnId = overId
    } else {
      targetColumnId = over.data.current?.task?.columnId || activeData?.task?.columnId
    }

    if (!targetColumnId) return

    const columnTasks = state.tasks
      .filter(t => t.columnId === targetColumnId && t.id !== taskId)
      .sort((a, b) => a.position - b.position)

    let newPosition: number
    if (over.data.current?.type === 'column') {
      newPosition = columnTasks.length
    } else {
      const overIndex = columnTasks.findIndex(t => t.id === overId)
      newPosition = overIndex >= 0 ? overIndex : columnTasks.length
    }

    dispatch({ type: 'REORDER_TASKS', payload: { taskId, columnId: targetColumnId, position: newPosition } })

    const updates = [
      { id: taskId, columnId: targetColumnId, position: newPosition },
      ...columnTasks.map((t, i) => ({ id: t.id, columnId: targetColumnId, position: i >= newPosition ? i + 1 : i })),
    ]
    api.tasks.reorder(state.currentProjectId!, updates).catch(console.error)
  }, [state.tasks, state.currentProjectId, dispatch])

  const handleAddColumn = async () => {
    if (!newColumnName.trim() || !state.currentProjectId) return
    const column = await api.columns.create(state.currentProjectId, { name: newColumnName.trim() })
    dispatch({ type: 'ADD_COLUMN', payload: column })
    setNewColumnName('')
    setAddingColumn(false)
  }

  const handleDeleteColumn = async (columnId: string) => {
    if (!state.currentProjectId) return
    await api.columns.delete(state.currentProjectId, columnId)
    dispatch({ type: 'REMOVE_COLUMN', payload: columnId })
  }

  const handleAddTask = async (columnId: string, title: string) => {
    if (!state.currentProjectId) return
    const task = await api.tasks.create(state.currentProjectId, { projectId: state.currentProjectId, title, columnId })
    dispatch({ type: 'ADD_TASK', payload: task })
  }

  const handleTaskUpdate = async (taskId: string, data: Record<string, unknown>) => {
    if (!state.currentProjectId) return
    const updated = await api.tasks.update(state.currentProjectId, taskId, data)
    dispatch({ type: 'UPDATE_TASK', payload: updated })
  }

  if (boardView === 'progress') {
    return <ProgressView />
  }

  const columns = state.columns.sort((a, b) => a.position - b.position)

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="px-6 pt-3 pb-6" style={{ height: 'calc(100vh - 44px)' }}>
        <div className="flex gap-4 h-full items-start overflow-x-auto pb-2">
          {columns.map((col) => (
            <BoardColumn
              key={col.id}
              column={col}
              tasks={state.tasks.filter(t => t.columnId === col.id)}
              tags={state.tags}
              onAddTask={(title) => handleAddTask(col.id, title)}
              onDeleteColumn={() => handleDeleteColumn(col.id)}
              onTaskUpdate={handleTaskUpdate}
              onTagCreated={(tag) => dispatch({ type: 'ADD_TAG', payload: tag })}
            />
          ))}
          {/* Add Column */}
          <div className="flex-shrink-0 w-72">
            {addingColumn ? (
              <div className="bg-muted/50 rounded-xl p-3 space-y-2 border border-border/50">
                <input
                  autoFocus
                  value={newColumnName}
                  onChange={(e) => setNewColumnName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleAddColumn(); if (e.key === 'Escape') setAddingColumn(false) }}
                  placeholder="列名称"
                  className="w-full px-2.5 py-1.5 text-sm border rounded-lg bg-background outline-none"
                />
                <div className="flex gap-1.5">
                  <button onClick={handleAddColumn} className="h-7 px-3 text-xs font-medium bg-foreground text-background rounded-lg">添加</button>
                  <button onClick={() => setAddingColumn(false)} className="h-7 px-3 text-xs text-muted-foreground hover:text-foreground">取消</button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setAddingColumn(true)}
                className="w-full flex items-center justify-center gap-1.5 h-10 px-4 text-sm text-muted-foreground/50 border-2 border-dashed border-border/50 rounded-xl hover:text-foreground hover:border-foreground/20 transition-colors"
              >
                <Plus className="w-4 h-4" /> 添加列
              </button>
            )}
          </div>
        </div>
      </div>
    </DndContext>
  )
}
