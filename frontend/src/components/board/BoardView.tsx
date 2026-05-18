import { useState, useCallback } from 'react'
import { DndContext, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { useBoard } from '../../contexts/BoardContext'
import { api } from '../../lib/api'
import { BoardColumn } from './BoardColumn'
import { ProgressView } from './ProgressView'
import { Plus } from 'lucide-react'
import type { BoardSubView } from '@ai-data-board/shared'

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

  const handleDeleteTask = async (taskId: string) => {
    if (!state.currentProjectId) return
    await api.tasks.delete(state.currentProjectId, taskId)
    dispatch({ type: 'REMOVE_TASK', payload: taskId })
  }

  if (boardView === 'progress') {
    return <ProgressView onTaskUpdate={handleTaskUpdate} />
  }

  const columns = state.columns.sort((a, b) => a.position - b.position)

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="px-5 pt-4 pb-6" style={{ height: 'calc(100vh - var(--navbar-height))' }}>
        <div className="flex gap-3.5 h-full items-start overflow-x-auto pb-2">
          {columns.map((col) => (
            <BoardColumn
              key={col.id}
              column={col}
              tasks={state.tasks.filter(t => t.columnId === col.id)}
              onAddTask={(title) => handleAddTask(col.id, title)}
              onDeleteColumn={() => handleDeleteColumn(col.id)}
              onTaskUpdate={handleTaskUpdate}
              onDeleteTask={handleDeleteTask}
            />
          ))}
          {/* Add Column */}
          <div className="flex-shrink-0 w-64">
            {addingColumn ? (
              <div className="bg-card border border-primary/30 rounded-xl p-3 space-y-2 shadow-sm ring-1 ring-primary/10">
                <input
                  autoFocus
                  value={newColumnName}
                  onChange={(e) => setNewColumnName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleAddColumn(); if (e.key === 'Escape') setAddingColumn(false) }}
                  placeholder="列名称"
                  className="w-full px-2.5 py-1.5 text-sm border border-border rounded-lg bg-background outline-none focus:border-primary/30 transition-colors"
                />
                <div className="flex gap-1.5">
                  <button onClick={handleAddColumn} className="h-7 px-3 text-xs font-medium bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity cursor-pointer">添加</button>
                  <button onClick={() => setAddingColumn(false)} className="h-7 px-2.5 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer">取消</button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setAddingColumn(true)}
                className="w-full flex items-center justify-center gap-1.5 h-10 px-4 text-sm text-muted-foreground border-2 border-dashed border-border rounded-xl hover:text-foreground hover:border-muted-foreground/30 hover:bg-card transition-all duration-150 cursor-pointer"
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
