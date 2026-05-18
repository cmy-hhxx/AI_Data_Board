import { useState, useEffect } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Task, Priority, User } from '@ai-data-board/shared'
import { User as UserIcon, X, Check, Trash2 } from 'lucide-react'
import { cn } from '../../lib/utils'
import { api } from '../../lib/api'

interface TaskCardProps {
  task: Task
  onUpdate: (taskId: string, data: Record<string, unknown>) => void
  onDelete: (taskId: string) => void
}

const priorityOptions: { value: Priority; label: string; color: string }[] = [
  { value: 'low', label: '低', color: 'bg-gray-300' },
  { value: 'medium', label: '中', color: 'bg-blue-500' },
  { value: 'high', label: '高', color: 'bg-orange-400' },
  { value: 'urgent', label: '紧急', color: 'bg-red-500' },
]

const priorityBar: Record<string, string> = {
  urgent: 'bg-red-500',
  high: 'bg-orange-400',
  medium: 'bg-blue-500',
  low: 'bg-gray-300',
}

// Module-level cache to avoid duplicate API calls across TaskCard instances
let usersCache: User[] | null = null
let usersLoading: Promise<User[]> | null = null

export function TaskCard({ task, onUpdate, onDelete }: TaskCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [priority, setPriority] = useState<Priority>(task.priority)
  const [assignee, setAssignee] = useState(task.assignee || '')
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [users, setUsers] = useState<User[]>(usersCache || [])

  useEffect(() => {
    if (usersCache) {
      setUsers(usersCache)
      return
    }
    if (!usersLoading) {
      usersLoading = api.users.list().then((list) => {
        usersCache = list
        return list
      })
    }
    usersLoading.then(setUsers)
  }, [])

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { task },
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const handleSave = () => {
    onUpdate(task.id, {
      priority,
      assignee: assignee || null,
    })
    setExpanded(false)
  }

  const handleCancel = () => {
    setPriority(task.priority)
    setAssignee(task.assignee || '')
    setExpanded(false)
  }

  const handleCardClick = (e: React.MouseEvent) => {
    // Don't expand when dragging
    e.stopPropagation()
    if (!isDragging) {
      setExpanded(true)
    }
  }

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    if (confirmingDelete) {
      onDelete(task.id)
      setConfirmingDelete(false)
      setExpanded(false)
    } else {
      setConfirmingDelete(true)
    }
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={handleCardClick}
      className={cn(
        'bg-card border border-border/70 rounded-xl cursor-grab active:cursor-grabbing shadow-[0_1px_3px_rgba(0,0,0,.04)] hover:shadow-[0_4px_12px_rgba(0,0,0,.08)] transition-all duration-150',
        isDragging && 'opacity-50 shadow-lg',
        expanded && 'cursor-default shadow-[0_4px_12px_rgba(0,0,0,.08)]'
      )}
    >
      {/* Collapsed view */}
      <div className="p-3.5">
        <div className={cn('h-0.5 w-8 rounded-full mb-2.5', priorityBar[task.priority])} />
        <p className="text-sm font-medium leading-snug text-foreground/90">{task.title}</p>

        {task.assignee && (
          <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground/70">
            <span className="flex items-center gap-1">
              <UserIcon className="w-3 h-3" />
              {users.find(u => u.id === task.assignee)?.name || task.assignee}
            </span>
          </div>
        )}
      </div>

      {/* Expanded edit form */}
      {expanded && (
        <div
          className="border-t border-border/40 px-3.5 py-3 space-y-3"
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          {/* Priority */}
          <div>
            <label className="text-[10px] font-medium text-muted-foreground/70 tracking-wide uppercase block mb-1.5">优先级</label>
            <div className="flex gap-1">
              {priorityOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setPriority(opt.value)}
                  className={cn(
                    'flex items-center gap-1 h-6 px-2 rounded text-[11px] transition-all',
                    priority === opt.value
                      ? 'bg-accent font-medium ring-1 ring-foreground/10'
                      : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                  )}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${opt.color}`} />
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Assignee */}
          <div>
            <label className="text-[10px] font-medium text-muted-foreground/70 tracking-wide uppercase block mb-1.5">指派人</label>
            <select
              value={assignee}
              onChange={(e) => setAssignee(e.target.value)}
              className="w-full h-7 px-2 text-xs border border-border/70 rounded-lg bg-background outline-none focus:border-foreground/20 transition-colors text-foreground"
            >
              <option value="">未指定</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-between pt-2">
            {confirmingDelete ? (
              <button
                onClick={handleDeleteClick}
                className="flex items-center gap-0.5 h-6 px-2 text-[11px] font-medium bg-red-500 text-white rounded-md hover:bg-red-600 transition-colors"
              >
                <Trash2 className="w-3 h-3" /> 确认删除
              </button>
            ) : (
              <button
                onClick={handleDeleteClick}
                className="flex items-center gap-0.5 h-6 px-2 text-[11px] text-muted-foreground hover:text-destructive transition-colors"
                title="删除任务"
              >
                <Trash2 className="w-3 h-3" /> 删除
              </button>
            )}
            <div className="flex items-center gap-1.5">
              <button onClick={handleCancel} className="flex items-center gap-0.5 h-6 px-2 text-[11px] text-muted-foreground hover:text-foreground transition-colors">
                <X className="w-3 h-3" /> 取消
              </button>
              <button onClick={handleSave} className="flex items-center gap-0.5 h-6 px-3 text-[11px] font-medium bg-foreground text-background rounded-md hover:opacity-90 transition-opacity">
                <Check className="w-3 h-3" /> 确认
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
