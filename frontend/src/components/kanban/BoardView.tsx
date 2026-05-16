import { useState, useCallback } from 'react'
import { DndContext, PointerSensor, useSensor, useSensors, type DragEndEvent, type DragOverEvent } from '@dnd-kit/core'
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
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        <div className="px-6 py-3 border-b flex items-center justify-between">
          <h1 className="text-lg font-bold">
            {state.projects.find(p => p.id === state.currentProjectId)?.name || '选择项目'}
          </h1>
        </div>
        <div className="flex-1 overflow-x-auto p-6">
          <div className="flex gap-4 h-full items-start">
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
            {/* Add Column Button */}
            <div className="flex-shrink-0 w-72">
              {addingColumn ? (
                <div className="bg-muted/30 rounded-lg p-3 space-y-2">
                  <input
                    autoFocus
                    value={newColumnName}
                    onChange={(e) => setNewColumnName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleAddColumn(); if (e.key === 'Escape') setAddingColumn(false) }}
                    placeholder="列名称"
                    className="w-full px-2 py-1.5 text-sm border rounded-md bg-background"
                  />
                  <div className="flex gap-1">
                    <button onClick={handleAddColumn} className="text-xs px-2 py-1 bg-primary text-primary-foreground rounded-md">添加</button>
                    <button onClick={() => setAddingColumn(false)} className="text-xs px-2 py-1 bg-muted rounded-md">取消</button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setAddingColumn(true)} className="w-full flex items-center gap-1 px-4 py-2.5 text-sm text-muted-foreground hover:bg-muted/50 rounded-lg transition-colors">
                  <Plus className="w-4 h-4" /> 添加列
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Quick Add Task Input */}
        {addingTaskInColumn && (
          <div className="fixed inset-0 z-40 flex items-start justify-center pt-20" onClick={() => setAddingTaskInColumn(null)}>
            <div className="bg-card border rounded-lg shadow-lg p-3 w-72" onClick={(e) => e.stopPropagation()}>
              <input
                autoFocus
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleAddTask(addingTaskInColumn); if (e.key === 'Escape') setAddingTaskInColumn(null) }}
                placeholder="输入任务标题"
                className="w-full px-2 py-1.5 text-sm border rounded-md"
              />
              <div className="flex gap-1 mt-2">
                <button onClick={() => handleAddTask(addingTaskInColumn)} className="text-xs px-2 py-1 bg-primary text-primary-foreground rounded-md">添加任务</button>
                <button onClick={() => setAddingTaskInColumn(null)} className="text-xs px-2 py-1 bg-muted rounded-md">取消</button>
              </div>
            </div>
          </div>
        )}
      </div>

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
