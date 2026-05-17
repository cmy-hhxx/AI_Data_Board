import { useState, useCallback } from 'react'
import { DndContext, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { useBoard } from '../../contexts/BoardContext'
import { api } from '../../lib/api'
import { BoardColumn } from './BoardColumn'
import { TaskDetailDialog } from './TaskDetailDialog'
import type { Task } from '@ai-data-board/shared'
import { Plus } from 'lucide-react'

export function BoardView() {
  const { state, dispatch } = useBoard()
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [addingColumn, setAddingColumn] = useState(false)
  const [newColumnName, setNewColumnName] = useState('')
  const [addingTaskInColumn, setAddingTaskInColumn] = useState<string | null>(null)
  const [newTaskTitle, setNewTaskTitle] = useState('')

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  )

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event
    if (!over) return

    const taskId = active.id as string
    const overId = over.id as string
    const activeData = active.data.current

    // Determine target column
    let targetColumnId: string
    if (over.data.current?.type === 'column') {
      targetColumnId = overId
    } else {
      targetColumnId = over.data.current?.task?.columnId || activeData?.task?.columnId
    }

    if (!targetColumnId) return

    // Calculate new position
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

    // Optimistic update
    dispatch({ type: 'REORDER_TASKS', payload: { taskId, columnId: targetColumnId, position: newPosition } })

    // Persist
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

  const handleAddTask = async (columnId: string) => {
    if (!newTaskTitle.trim() || !state.currentProjectId) return
    const task = await api.tasks.create(state.currentProjectId, { projectId: state.currentProjectId, title: newTaskTitle.trim(), columnId })
    dispatch({ type: 'ADD_TASK', payload: task })
    setNewTaskTitle('')
    setAddingTaskInColumn(null)
  }

  const handleTaskUpdate = async (taskId: string, data: Record<string, unknown>) => {
    if (!state.currentProjectId) return
    const updated = await api.tasks.update(state.currentProjectId, taskId, data)
    dispatch({ type: 'UPDATE_TASK', payload: updated })
    setSelectedTask(prev => prev?.id === taskId ? updated : prev)
  }

  const handleTaskDelete = async (taskId: string) => {
    if (!state.currentProjectId) return
    await api.tasks.delete(state.currentProjectId, taskId)
    dispatch({ type: 'REMOVE_TASK', payload: taskId })
    setSelectedTask(null)
  }

  const columns = state.columns.sort((a, b) => a.position - b.position)

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="px-6 pt-2 pb-6" style={{ height: 'calc(100vh - 72px)' }}>
        <div className="flex gap-5 h-full items-start overflow-x-auto">
          {columns.map((col) => (
            <BoardColumn
              key={col.id}
              column={col}
              tasks={state.tasks.filter(t => t.columnId === col.id)}
              onAddTask={() => { setAddingTaskInColumn(col.id); setNewTaskTitle('') }}
              onDeleteColumn={() => handleDeleteColumn(col.id)}
              onTaskClick={setSelectedTask}
            />
          ))}
          {/* Add Column */}
          <div className="flex-shrink-0 w-72 pt-2">
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
              <button onClick={() => setAddingColumn(true)} className="w-full flex items-center justify-center gap-1.5 h-10 px-4 text-sm text-muted-foreground/60 border-2 border-dashed border-border/60 rounded-xl hover:text-foreground hover:border-foreground/20 transition-colors">
                <Plus className="w-4 h-4" /> 添加列
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Quick add task overlay */}
      {addingTaskInColumn && (
        <div className="fixed inset-0 z-40 flex items-start justify-center pt-24" onClick={() => setAddingTaskInColumn(null)}>
          <div className="bg-card border border-border/80 rounded-xl shadow-lg p-4 w-80 backdrop-blur-xl" onClick={(e) => e.stopPropagation()}>
            <input
              autoFocus
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleAddTask(addingTaskInColumn); if (e.key === 'Escape') setAddingTaskInColumn(null) }}
              placeholder="输入任务标题..."
              className="w-full px-3 py-2 text-sm border rounded-lg bg-background outline-none"
            />
            <div className="flex gap-1.5 mt-2.5">
              <button onClick={() => handleAddTask(addingTaskInColumn)} className="h-8 px-4 text-xs font-medium bg-foreground text-background rounded-lg hover:opacity-90 transition-opacity">添加任务</button>
              <button onClick={() => setAddingTaskInColumn(null)} className="h-8 px-3 text-xs text-muted-foreground hover:text-foreground">取消</button>
            </div>
          </div>
        </div>
      )}

      {selectedTask && (
        <TaskDetailDialog
          task={selectedTask}
          tags={state.tags}
          selectedTagIds={selectedTask.tags?.map(t => t.id) || []}
          onClose={() => setSelectedTask(null)}
          onUpdate={(data) => handleTaskUpdate(selectedTask.id, data)}
          onDelete={() => handleTaskDelete(selectedTask.id)}
          onTagCreated={(tag) => dispatch({ type: 'ADD_TAG', payload: tag })}
          onTagDeleted={(tagId) => dispatch({ type: 'REMOVE_TAG', payload: tagId })}
        />
      )}
    </DndContext>
  )
}
