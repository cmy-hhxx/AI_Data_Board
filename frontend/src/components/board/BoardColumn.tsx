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
  const { setNodeRef, isOver } = useDroppable({ id: column.id, data: { type: 'column', columnId: column.id } })
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
    <div className="group/col flex-shrink-0 w-72 flex flex-col bg-surface-2 rounded-xl max-h-full border border-border/60">
      {/* Column header */}
      <div className="px-3.5 py-2.5 flex items-center justify-between shrink-0 border-b border-border/40">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-semibold text-foreground truncate">{column.name}</span>
          <span className="inline-flex items-center justify-center h-4.5 min-w-[1.25rem] px-1.5 rounded-full bg-muted text-[11px] font-medium text-muted-foreground tabular-nums">
            {tasks.length}
          </span>
        </div>
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => { setAddingTask(true); setTaskTitle('') }}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors cursor-pointer"
            title="添加任务"
            aria-label="添加任务"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onDeleteColumn}
            className="p-1.5 rounded-lg text-muted-foreground/0 group-hover/col:text-muted-foreground/40 hover:!text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
            title="删除列"
            aria-label="删除列"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Task list */}
      <div
        ref={setNodeRef}
        className={`flex-1 p-2 space-y-2 overflow-y-auto min-h-[80px] rounded-b-xl transition-all duration-200 ease-in-out ${
          isOver
            ? 'bg-primary/[0.04] ring-2 ring-primary/25 ring-inset shadow-inner'
            : 'ring-0'
          }`}
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
          <div className="bg-card border border-border rounded-xl p-3 space-y-2 shadow-sm">
            <input
              ref={inputRef}
              value={taskTitle}
              onChange={(e) => setTaskTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSubmit()
                if (e.key === 'Escape') { setAddingTask(false); setTaskTitle('') }
              }}
              placeholder="任务标题…"
              className="w-full px-2.5 py-1.5 text-sm bg-background border border-border rounded-lg outline-none focus:border-primary/30 transition-colors"
            />
            <div className="flex items-center gap-1.5">
              <button
                onClick={handleSubmit}
                disabled={isSubmitting || !taskTitle.trim()}
                className="h-7 px-3 text-xs font-medium bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 cursor-pointer"
              >
                {isSubmitting ? '添加中…' : '添加'}
              </button>
              <button
                onClick={() => { setAddingTask(false); setTaskTitle('') }}
                className="h-7 px-2.5 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              >
                取消
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => { setAddingTask(true); setTaskTitle('') }}
            className="w-full flex items-center gap-1.5 h-8 px-2 text-xs text-muted-foreground/50 hover:text-muted-foreground rounded-lg hover:bg-accent/60 transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            添加任务
          </button>
        )}
      </div>
    </div>
  )
}
