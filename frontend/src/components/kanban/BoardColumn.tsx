import { useState, useRef, useEffect } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import type { BoardColumn as BoardColumnType, Task, Tag, Priority, CreateTaskInput } from '@ai-data-board/shared'
import { TaskCard } from './TaskCard'
import { CalendarDays, Plus, Trash2, User } from 'lucide-react'

interface BoardColumnProps {
  column: BoardColumnType
  tasks: Task[]
  tags: Tag[]
  onAddTask: (input: Omit<CreateTaskInput, 'projectId' | 'columnId'>) => Promise<void>
  onDeleteColumn: () => void
  onTaskUpdate: (taskId: string, data: Record<string, unknown>) => void
  onTagCreated: (tag: Tag) => void
}

export function BoardColumn({ column, tasks, tags, onAddTask, onDeleteColumn, onTaskUpdate, onTagCreated }: BoardColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id, data: { type: 'column' } })
  const [addingTask, setAddingTask] = useState(false)
  const [taskTitle, setTaskTitle] = useState('')
  const [taskAssignee, setTaskAssignee] = useState('')
  const [taskPriority, setTaskPriority] = useState<Priority>('medium')
  const [taskEndDate, setTaskEndDate] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (addingTask) inputRef.current?.focus()
  }, [addingTask])

  const handleSubmit = async () => {
    const title = taskTitle.trim()
    if (!title) { setAddingTask(false); return }
    await onAddTask({
      title,
      assignee: taskAssignee.trim() || undefined,
      priority: taskPriority,
      endDate: taskEndDate || undefined,
    })
    setTaskTitle('')
    setTaskAssignee('')
    setTaskPriority('medium')
    setTaskEndDate('')
    setAddingTask(false)
  }

  const handleCancelAdd = () => {
    setAddingTask(false)
    setTaskTitle('')
    setTaskAssignee('')
    setTaskPriority('medium')
    setTaskEndDate('')
  }

  const sortedTasks = [...tasks].sort((a, b) => a.position - b.position)

  return (
    <div className="flex-shrink-0 w-72 flex flex-col bg-muted/30 rounded-xl max-h-full">
      {/* Column header */}
      <div className="px-3.5 py-2.5 flex items-center justify-between border-b border-border/40 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          {column.color && (
            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: column.color }} />
          )}
          <h3 className="text-sm font-semibold truncate">{column.name}</h3>
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
              tags={tags}
              onUpdate={onTaskUpdate}
              onDelete={() => {}}
              onTagCreated={onTagCreated}
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
                if (e.key === 'Escape') handleCancelAdd()
              }}
              placeholder="任务标题..."
              className="w-full px-2.5 py-1.5 text-sm bg-background border border-border/60 rounded-lg outline-none focus:border-foreground/25 transition-colors"
            />
            <div className="grid grid-cols-[1fr_auto] gap-2">
              <label className="flex items-center gap-1.5 h-7 px-2 rounded-lg bg-background border border-border/50 text-muted-foreground focus-within:border-foreground/25 transition-colors">
                <User className="w-3.5 h-3.5 shrink-0" />
                <input
                  value={taskAssignee}
                  onChange={(e) => setTaskAssignee(e.target.value)}
                  placeholder="姓名"
                  className="min-w-0 flex-1 bg-transparent text-xs text-foreground outline-none placeholder:text-muted-foreground/50"
                />
              </label>
              <select
                value={taskPriority}
                onChange={(e) => setTaskPriority(e.target.value as Priority)}
                className="h-7 px-2 text-xs bg-background border border-border/50 rounded-lg outline-none focus:border-foreground/25"
                aria-label="优先级"
              >
                <option value="low">低</option>
                <option value="medium">中</option>
                <option value="high">高</option>
                <option value="urgent">紧急</option>
              </select>
            </div>
            <label className="flex items-center gap-1.5 h-7 px-2 rounded-lg bg-background border border-border/50 text-muted-foreground focus-within:border-foreground/25 transition-colors">
              <CalendarDays className="w-3.5 h-3.5 shrink-0" />
              <span className="text-[11px] shrink-0">截止</span>
              <input
                type="date"
                value={taskEndDate}
                onChange={(e) => setTaskEndDate(e.target.value)}
                className="min-w-0 flex-1 bg-transparent text-xs text-foreground outline-none"
              />
            </label>
            <div className="flex items-center gap-1.5">
              <button
                onClick={handleSubmit}
                className="h-7 px-3 text-xs font-medium bg-foreground text-background rounded-lg hover:opacity-85 transition-opacity"
              >
                添加
              </button>
              <button
                onClick={handleCancelAdd}
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
