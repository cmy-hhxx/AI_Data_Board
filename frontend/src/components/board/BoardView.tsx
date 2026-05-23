import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import {
  DndContext,
  DragOverlay,
  MeasuringStrategy,
  PointerSensor,
  closestCorners,
  pointerWithin,
  rectIntersection,
  useSensor,
  useSensors,
  type Collision,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { useBoard } from '../../contexts/BoardContext'
import { api } from '../../lib/api'
import { BoardColumn } from './BoardColumn'
import { ListView } from './ListView'
import { GanttView } from './GanttView'
import { TaskCardOverlay } from './TaskCard'
import { Archive, Plus } from 'lucide-react'
import type { BatchUpdatePosition, BoardSubView, Task } from '@ai-data-board/shared'

interface BoardViewProps {
  boardView: BoardSubView
}

const SORT_ACTIVATION_RATIO = 0.3

const boardCollisionDetection: CollisionDetection = (args) => {
  const preferTaskCollisions = (collisions: Collision[]) => {
    const taskCollisions = collisions.filter(
      (collision) => collision.data?.droppableContainer?.data.current?.type === 'task',
    )
    return taskCollisions.length > 0 ? taskCollisions : collisions
  }

  const pointerCollisions = preferTaskCollisions(pointerWithin(args))
  if (pointerCollisions.length > 0) return pointerCollisions

  const intersections = preferTaskCollisions(rectIntersection(args))
  if (intersections.length > 0) return intersections

  return preferTaskCollisions(closestCorners(args))
}

function sortTasks(tasks: Task[]) {
  return [...tasks].sort((a, b) => a.position - b.position)
}

function getTaskColumnId(tasks: Task[], taskId: string) {
  return tasks.find((task) => task.id === taskId)?.columnId ?? null
}

function getTargetColumnId(event: DragOverEvent | DragEndEvent, tasks: Task[]) {
  const { active, over } = event
  if (!over) return null

  if (over.data.current?.type === 'column') {
    return over.id as string
  }

  if (over.data.current?.type === 'task') {
    return over.data.current.task.columnId as string | null
  }

  return getTaskColumnId(tasks, over.id as string) ?? getTaskColumnId(tasks, active.id as string)
}

function getTargetIndex(event: DragOverEvent | DragEndEvent, targetTasks: Task[]) {
  const { over } = event
  if (!over) return targetTasks.length
  if (over.data.current?.type === 'column') return getColumnTargetIndex(event, targetTasks)

  const overIndex = targetTasks.findIndex((task) => task.id === over.id)
  if (overIndex < 0) return getColumnTargetIndex(event, targetTasks)

  return getTaskTargetIndex(event, overIndex, targetTasks.length)
}

function getTaskTargetIndex(event: DragOverEvent | DragEndEvent, overIndex: number, targetTaskCount: number) {
  const activeRect = event.active.rect.current.translated
  const overRect = event.over?.rect
  if (!activeRect || !overRect) return event.delta.y > 0 ? overIndex + 1 : overIndex

  const activeCenterY = activeRect.top + activeRect.height / 2
  const upperThreshold = overRect.top + overRect.height * SORT_ACTIVATION_RATIO
  const lowerThreshold = overRect.bottom - overRect.height * SORT_ACTIVATION_RATIO

  if (event.delta.y > 0 && activeCenterY > upperThreshold) {
    return Math.min(overIndex + 1, targetTaskCount)
  }

  if (event.delta.y < 0 && activeCenterY < lowerThreshold) {
    return overIndex
  }

  return overIndex
}

function getColumnTargetIndex(event: DragOverEvent | DragEndEvent, targetTasks: Task[]) {
  const activeRect = event.active.rect.current.translated
  if (!activeRect) return targetTasks.length

  const activeCenterY = activeRect.top + activeRect.height / 2

  for (let index = 0; index < targetTasks.length; index += 1) {
    const rect = getTaskElementRect(targetTasks[index].id)
    if (rect && activeCenterY < rect.top + rect.height * SORT_ACTIVATION_RATIO) return index
  }

  return targetTasks.length
}

function getTaskElementRect(taskId: string) {
  if (typeof document === 'undefined') return null

  for (const element of document.querySelectorAll<HTMLElement>('[data-board-task-id]')) {
    if (element.dataset.boardTaskId === taskId) return element.getBoundingClientRect()
  }

  return null
}

export function buildReorderedTasks(
  tasks: Task[],
  event: DragOverEvent | DragEndEvent,
  originalTasks: Task[] | null,
  movedAt: string,
) {
  const activeTaskId = event.active.id as string
  const activeTask = tasks.find((task) => task.id === activeTaskId)
  if (!activeTask) return tasks

  const targetColumnId = getTargetColumnId(event, tasks)
  if (!targetColumnId) return tasks
  if (event.over?.id === activeTaskId) return tasks

  const currentColumnId = activeTask.columnId
  const targetTasks = sortTasks(tasks.filter((task) => task.columnId === targetColumnId && task.id !== activeTaskId))
  const targetIndex = Math.max(0, Math.min(getTargetIndex(event, targetTasks), targetTasks.length))
  const originalTask = originalTasks?.find((task) => task.id === activeTaskId)
  const columnEnteredAt = originalTask?.columnId === targetColumnId
    ? originalTask.columnEnteredAt
    : currentColumnId === targetColumnId
      ? activeTask.columnEnteredAt
      : movedAt

  const affected = new Map<string, Task>()
  const nextTargetTasks = [
    ...targetTasks.slice(0, targetIndex),
    { ...activeTask, columnId: targetColumnId, columnEnteredAt },
    ...targetTasks.slice(targetIndex),
  ]

  nextTargetTasks.forEach((task, position) => {
    affected.set(task.id, { ...task, position })
  })

  if (currentColumnId && currentColumnId !== targetColumnId) {
    sortTasks(tasks.filter((task) => task.columnId === currentColumnId && task.id !== activeTaskId))
      .forEach((task, position) => {
        affected.set(task.id, { ...task, position })
      })
  }

  const nextTasks = tasks.map((task) => affected.get(task.id) ?? task)
  return hasTaskLayoutChanged(tasks, nextTasks) ? nextTasks : tasks
}

function hasTaskLayoutChanged(before: Task[], after: Task[]) {
  if (before.length !== after.length) return true

  const beforeById = new Map(before.map((task) => [task.id, task]))

  return after.some((task) => {
    const previous = beforeById.get(task.id)
    return !previous
      || previous.columnId !== task.columnId
      || previous.position !== task.position
      || previous.columnEnteredAt !== task.columnEnteredAt
  })
}

function getChangedPositions(before: Task[], after: Task[]): BatchUpdatePosition[] {
  const beforeById = new Map(before.map((task) => [task.id, task]))

  return after.flatMap((task) => {
    if (!task.columnId) return []

    const previous = beforeById.get(task.id)
    if (!previous || previous.columnId !== task.columnId || previous.position !== task.position) {
      return [{ id: task.id, columnId: task.columnId, position: task.position }]
    }

    return []
  })
}

function getPersistedPositions(tasks: Task[]): BatchUpdatePosition[] {
  return tasks.flatMap((task) => {
    if (!task.columnId) return []
    return [{ id: task.id, columnId: task.columnId, position: task.position }]
  })
}

export function BoardView({ boardView }: BoardViewProps) {
  const { state, dispatch } = useBoard()
  const [addingColumn, setAddingColumn] = useState(false)
  const [newColumnName, setNewColumnName] = useState('')
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null)
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false)
  const [isArchiving, setIsArchiving] = useState(false)
  const tasksRef = useRef<Task[]>(state.tasks)
  const dragSnapshotRef = useRef<Task[] | null>(null)
  const movedAtRef = useRef<string>(new Date().toISOString())
  const reorderQueueRef = useRef(Promise.resolve())
  const localDragSeqRef = useRef(0)
  const currentProjectIdRef = useRef(state.currentProjectId)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 2 } })
  )

  useEffect(() => {
    tasksRef.current = state.tasks
  }, [state.tasks])

  useEffect(() => {
    currentProjectIdRef.current = state.currentProjectId
  }, [state.currentProjectId])

  const applyLocalDragMove = useCallback((event: DragOverEvent | DragEndEvent) => {
    if (!event.over) return tasksRef.current

    const nextTasks = buildReorderedTasks(
      tasksRef.current,
      event,
      dragSnapshotRef.current,
      movedAtRef.current,
    )

    if (nextTasks !== tasksRef.current) {
      tasksRef.current = nextTasks
      dispatch({ type: 'SET_TASKS', payload: nextTasks, source: 'local' })
    }

    return nextTasks
  }, [dispatch])

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const taskId = event.active.id as string
    setActiveTaskId(taskId)
    localDragSeqRef.current += 1
    dragSnapshotRef.current = tasksRef.current
    movedAtRef.current = new Date().toISOString()
    dispatch({ type: 'BEGIN_TASK_SYNC' })
  }, [dispatch])

  const handleDragOver = useCallback((event: DragOverEvent) => {
    applyLocalDragMove(event)
  }, [applyLocalDragMove])

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const projectId = state.currentProjectId
    const snapshot = dragSnapshotRef.current

    setActiveTaskId(null)

    if (!projectId || !snapshot) {
      dragSnapshotRef.current = null
      dispatch({ type: 'END_TASK_SYNC' })
      return
    }

    if (!event.over) {
      tasksRef.current = snapshot
      dispatch({ type: 'SET_TASKS', payload: snapshot, source: 'local' })
      dragSnapshotRef.current = null
      dispatch({ type: 'END_TASK_SYNC' })
      return
    }

    const finalTasks = applyLocalDragMove(event)
    const updates = getChangedPositions(snapshot, finalTasks)
    const persistedLayout = getPersistedPositions(finalTasks)
    const dragSeq = localDragSeqRef.current
    dragSnapshotRef.current = null

    if (updates.length === 0) {
      dispatch({ type: 'END_TASK_SYNC' })
      return
    }

    const persistReorder = async () => {
      try {
        await api.tasks.reorder(projectId, persistedLayout)
      } catch (error) {
        console.error(error)
        if (dragSeq !== localDragSeqRef.current || projectId !== currentProjectIdRef.current) return

        try {
          const serverTasks = await api.tasks.list(projectId)
          if (dragSeq !== localDragSeqRef.current || projectId !== currentProjectIdRef.current) return
          tasksRef.current = serverTasks
          dispatch({ type: 'SET_TASKS', payload: serverTasks, source: 'force' })
        } catch (reloadError) {
          console.error(reloadError)
          if (dragSeq !== localDragSeqRef.current || projectId !== currentProjectIdRef.current) return
          tasksRef.current = snapshot
          dispatch({ type: 'SET_TASKS', payload: snapshot, source: 'local' })
        }
      } finally {
        dispatch({ type: 'END_TASK_SYNC' })
      }
    }

    reorderQueueRef.current = reorderQueueRef.current.then(persistReorder, persistReorder)
    await reorderQueueRef.current
  }, [applyLocalDragMove, dispatch, state.currentProjectId])

  const handleDragCancel = useCallback(() => {
    if (dragSnapshotRef.current) {
      tasksRef.current = dragSnapshotRef.current
      dispatch({ type: 'SET_TASKS', payload: dragSnapshotRef.current, source: 'local' })
      dispatch({ type: 'END_TASK_SYNC' })
    }
    setActiveTaskId(null)
    dragSnapshotRef.current = null
  }, [dispatch])

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

  const handleArchiveProject = async () => {
    if (!state.currentProjectId || isArchiving) return
    setIsArchiving(true)
    try {
      await api.projects.archive(state.currentProjectId)
      dispatch({ type: 'REMOVE_PROJECT', payload: state.currentProjectId })
      dispatch({ type: 'SET_CURRENT_PROJECT', payload: null })
      setShowArchiveConfirm(false)
      setIsArchiving(false)
    } catch {
      setIsArchiving(false)
    }
  }

  const columns = useMemo(() => [...state.columns].sort((a, b) => a.position - b.position), [state.columns])
  const activeTask = activeTaskId ? state.tasks.find((task) => task.id === activeTaskId) : null

  if (boardView === 'list') {
    return <ListView onTaskUpdate={handleTaskUpdate} />
  }
  if (boardView === 'progress') {
    return <GanttView onTaskUpdate={handleTaskUpdate} />
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={boardCollisionDetection}
      measuring={{ droppable: { strategy: MeasuringStrategy.WhileDragging } }}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      {/* Project header with archive button */}
      {state.currentProjectId && (
        <div className="flex items-center justify-between px-5 pt-4 pb-2">
          <h1 className="text-base font-semibold text-foreground">
            {state.projects.find(p => p.id === state.currentProjectId)?.name}
          </h1>
          <button
            onClick={() => setShowArchiveConfirm(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg transition-colors cursor-pointer"
            title="归档项目"
          >
            <Archive className="w-3.5 h-3.5" />
            归档
          </button>
        </div>
      )}

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

      {/* Archive confirmation dialog */}
      {showArchiveConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm"
          onClick={() => setShowArchiveConfirm(false)}
        >
          <div
            className="bg-card border border-border rounded-xl p-6 shadow-xl max-w-sm w-full mx-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-start gap-3 mb-4">
              <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                <Archive className="w-4.5 h-4.5 text-muted-foreground" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-1">归档项目</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  归档 <span className="font-medium text-foreground">「{state.projects.find(p => p.id === state.currentProjectId)?.name}」</span>
                  {' '}后将从总览移除，可在已归档页面查看和恢复。
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setShowArchiveConfirm(false)}
                className="h-8 px-4 text-xs font-medium text-muted-foreground hover:text-foreground border border-border rounded-lg hover:bg-accent transition-colors cursor-pointer"
              >
                取消
              </button>
              <button
                onClick={handleArchiveProject}
                disabled={isArchiving}
                className="h-8 px-4 text-xs font-medium bg-primary text-primary-foreground rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity cursor-pointer"
              >
                {isArchiving ? '归档中…' : '确认归档'}
              </button>
            </div>
          </div>
        </div>
      )}

      <DragOverlay adjustScale={false} dropAnimation={null}>
        {activeTask ? <TaskCardOverlay task={activeTask} /> : null}
      </DragOverlay>
    </DndContext>
  )
}
