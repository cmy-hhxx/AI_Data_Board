import { useState, useRef, useEffect } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import type { BoardColumn as BoardColumnType, Task } from '@ai-data-board/shared'
import { TaskCard } from './TaskCard'
import { Plus, Trash2 } from 'lucide-react'

interface BoardColumnProps {
  column: BoardColumnType
  tasks: Task[]
  onAddTask: (title: string) => Promise<void>
  onDeleteColumn: () => void
  onTaskUpdate: (taskId: string, data: Record<string, unknown>) => void
  onDeleteTask: (taskId: string) => void
}

export function BoardColumn({ column, tasks, onAddTask, onDeleteColumn, onTaskUpdate, onDeleteTask }: BoardColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id, data: { type: 'column' } })
  const [addingTask, setAddingTask] = useState(false)
  const [taskTitle, setTaskTitle] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (addingTask) inputRef.current?.focus()
  }, [addingTask])

  const handleSubmit = async () => {
    const title = taskTitle.trim()
    if (!title || isSubmitting) { setAddingTask(false); return }
    setIsSubmitting(true)
    try {
      await onAddTask(title)
      setTaskTitle('')
      setAddingTask(false)
    } finally {
      setIsSubmitting(false)
    }
  }

  const sortedTasks = [...tasks].sort((a, b) => a.position - b.position)

  return (
    <div className="flex-shrink-0 w-72 flex flex-col bg-muted/30 rounded-xl max-h-full">
      {/* Column header */}
      <div className="px-3.5 py-2.5 flex items-center justify-between border-b border-border/40 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <div className="text-sm font-semibold truncate">{column.name}</div>
          <span className="text-[11px] font-medium text-muted-foreground/50 tabular-nums">{tasks.length}</span>
        </div>
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => { setAddingTask(true); setTaskTitle('') }}
            className="p-1 hover:bg-accent rounded-lg transition-colors"
            title="添加任务"
          >
            <Plus className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
          <button onClick={onDeleteColumn} className="p-1 hover:bg-accent rounded-lg transition-colors" title="删除列">
            <Trash2 className="w-3.5 h-3.5 text-muted-foreground/40 hover:text-destructive transition-colors" />
          </button>
        </div>
      </div>

      {/* Task list */}
      <div
        ref={setNodeRef}
        className={`flex-1 p-2 space-y-2 overflow-y-auto min-h-[60px] transition-colors ${isOver ? 'bg-accent/30' : ''}`}
      >
        <SortableContext items={sortedTasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
          {sortedTasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onUpdate={onTaskUpdate}
              onDelete={onDeleteTask}
            />
          ))}
        </SortableContext>
      </div>

      {/* Inline add task form */}
      <div className="px-2 pb-2 shrink-0">
        {addingTask ? (
          <div className="bg-card border border-border/60 rounded-xl p-3 space-y-2 shadow-sm">
            <input
              ref={inputRef}
              value={taskTitle}
              onChange={(e) => setTaskTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSubmit()
                if (e.key === 'Escape') { setAddingTask(false); setTaskTitle('') }
              }}
              placeholder="任务标题..."
              className="w-full px-2.5 py-1.5 text-sm bg-background border border-border/60 rounded-lg outline-none focus:border-foreground/25 transition-colors"
            />
            <div className="flex items-center gap-1.5">
              <button
                onClick={handleSubmit}
                disabled={isSubmitting || !taskTitle.trim()}
                className="h-7 px-3 text-xs font-medium bg-foreground text-background rounded-lg hover:opacity-85 transition-opacity disabled:opacity-50"
              >
                {isSubmitting ? '添加中...' : '添加'}
              </button>
              <button
                onClick={() => { setAddingTask(false); setTaskTitle('') }}
                className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                取消
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => { setAddingTask(true); setTaskTitle('') }}
            className="w-full flex items-center gap-1.5 h-8 px-2 text-xs text-muted-foreground/60 hover:text-muted-foreground rounded-lg hover:bg-accent/50 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            添加任务
          </button>
        )}
      </div>
    </div>
  )
}
