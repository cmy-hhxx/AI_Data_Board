import { useState, useEffect, useRef, type ButtonHTMLAttributes, type MouseEvent as ReactMouseEvent } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Task, Priority, User } from '@ai-data-board/shared'
import { X, Check, Trash2, Clock, AlertCircle, GripVertical } from 'lucide-react'
import { cn } from '../../lib/utils'
import { api } from '../../lib/api'

interface TaskCardProps {
  task: Task
  onUpdate: (taskId: string, data: Record<string, unknown>) => void
  onDelete: (taskId: string) => void
}

// Priority config using CSS token variables
const priorityConfig: Record<Priority, { label: string; color: string }> = {
  low: { label: '低', color: 'hsl(var(--priority-low))' },
  medium: { label: '中', color: 'hsl(var(--priority-medium))' },
  high: { label: '高', color: 'hsl(var(--priority-high))' },
  urgent: { label: '紧急', color: 'hsl(var(--priority-urgent))' },
}

const priorityOrder: Priority[] = ['low', 'medium', 'high', 'urgent']

const avatarColors = [
  '#4C72B0', '#DD8452', '#55A868', '#C44E52', '#8172B3',
  '#937860', '#DA8BC3', '#CCB974', '#64B5CD', '#2A9D8F',
]

// Module-level cache to avoid duplicate API calls across TaskCard instances
let usersCache: User[] | null = null
let usersLoading: Promise<User[]> | null = null

function useCachedUsers() {
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
    usersLoading.then(setUsers).catch(console.error)
  }, [])

  return users
}

function UserAvatar({ name, size = 'sm' }: { name: string; size?: 'sm' | 'xs' }) {
  const initials = name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
  const sizeClass = size === 'xs' ? 'w-5 h-5 text-[9px]' : 'w-6 h-6 text-[10px]'
  const color = avatarColors[getStringHash(name) % avatarColors.length]

  return (
    <span
      className={cn('rounded-full flex items-center justify-center font-bold text-white shrink-0 shadow-sm ring-1 ring-black/5', sizeClass)}
      style={{ backgroundColor: color }}
    >
      {initials}
    </span>
  )
}

function getStringHash(value: string) {
  let hash = 0
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0
  }
  return hash
}

function TaskSummary({
  task,
  users,
  dragHandleProps,
  isOverlay = false,
}: {
  task: Task
  users: User[]
  dragHandleProps?: ButtonHTMLAttributes<HTMLButtonElement>
  isOverlay?: boolean
}) {
  const assignedUser = users.find(u => u.id === task.assignee)

  const handleDragButtonClick = (event: ReactMouseEvent<HTMLButtonElement>) => {
    event.preventDefault()
    event.stopPropagation()
    dragHandleProps?.onClick?.(event)
  }

  return (
    <div className="px-3 py-3 min-w-0">
      <div className="flex items-start gap-2 min-w-0">
        <p className="flex-1 text-sm font-medium leading-snug text-foreground min-w-0 break-words">{task.title}</p>
        {dragHandleProps ? (
          <button
            type="button"
            {...dragHandleProps}
            onClick={handleDragButtonClick}
            className="shrink-0 -mt-1 -mr-1 inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground/60 hover:text-foreground hover:bg-accent transition-colors cursor-grab active:cursor-grabbing"
            title="拖动任务"
            aria-label={`拖动任务：${task.title}`}
          >
            <GripVertical className="w-4 h-4" />
          </button>
        ) : (
          <span
            className={cn(
              'shrink-0 -mt-1 -mr-1 inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground/50',
              isOverlay && 'text-primary/70',
            )}
            aria-hidden="true"
          >
            <GripVertical className="w-4 h-4" />
          </span>
        )}
      </div>

      {(task.assignee || task.estimatedDays != null || task.blocker) && (
        <div className="flex items-center gap-2.5 mt-2 flex-wrap min-w-0">
          {assignedUser && (
            <div className="flex items-center gap-1.5 min-w-0">
              <UserAvatar name={assignedUser.name} size="xs" />
              <span className="text-xs text-muted-foreground truncate">{assignedUser.name}</span>
            </div>
          )}
          {task.estimatedDays != null && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
              <Clock className="w-3 h-3" />
              {task.estimatedDays}天
            </span>
          )}
          {task.blocker && (
            <span className="flex items-center gap-1 text-xs text-amber-600 min-w-0">
              <AlertCircle className="w-3 h-3 shrink-0" />
              <span className="truncate">{task.blocker.length > 6 ? task.blocker.slice(0, 6) + '…' : task.blocker}</span>
            </span>
          )}
        </div>
      )}
    </div>
  )
}

export function TaskCard({ task, onUpdate, onDelete }: TaskCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [priority, setPriority] = useState<Priority>(task.priority)
  const [assignee, setAssignee] = useState(task.assignee || '')
  const [estimatedDays, setEstimatedDays] = useState(task.estimatedDays ?? '')
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const users = useCachedUsers()
  const cardRef = useRef<HTMLDivElement>(null)

  // Click outside to collapse (with cancel semantics)
  useEffect(() => {
    if (!expanded) return
    const handleClickOutside = (e: MouseEvent) => {
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) {
        handleCancel()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [expanded])

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { type: 'task', task },
  })

  const sortTransition = transition || ''
  const style = {
    transform: isDragging ? undefined : CSS.Transform.toString(transform),
    transition: sortTransition
      ? `${sortTransition}, opacity 150ms ease, box-shadow 150ms ease`
      : 'opacity 150ms ease, box-shadow 150ms ease',
  }

  const handleSave = () => {
    onUpdate(task.id, {
      priority,
      assignee: assignee || null,
      estimatedDays: estimatedDays === '' ? null : Number(estimatedDays),
    })
    setExpanded(false)
  }

  const handleCancel = () => {
    setPriority(task.priority)
    setAssignee(task.assignee || '')
    setEstimatedDays(task.estimatedDays ?? '')
    setConfirmingDelete(false)
    setExpanded(false)
  }

  const handleCardClick = (e: ReactMouseEvent) => {
    e.stopPropagation()
    if (!isDragging && !expanded) setExpanded(true)
  }

  const handleDeleteClick = (e: ReactMouseEvent) => {
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
      ref={(node) => { setNodeRef(node); cardRef.current = node }}
      data-board-task-id={task.id}
      style={style}
      onClick={handleCardClick}
      className={cn(
        'bg-card border rounded-xl overflow-hidden relative',
        'border-border shadow-[0_1px_2px_rgba(0,0,0,.05)]',
        isDragging
          ? 'opacity-30 shadow-none border-primary/20'
          : 'hover:shadow-[0_3px_10px_rgba(0,0,0,.08)] hover:border-border/80',
        expanded
          ? 'cursor-default shadow-[0_4px_16px_rgba(0,0,0,.1)] border-border ring-1 ring-primary/10'
          : !isDragging && 'cursor-pointer'
      )}
    >
      <TaskSummary task={task} users={users} dragHandleProps={{ ...attributes, ...listeners }} />

      {/* Expanded edit form */}
      {expanded && (
        <div
          className="border-t border-border px-3.5 py-3.5 space-y-3.5"
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          {/* Priority */}
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-2">优先级</label>
            <div className="flex gap-1 flex-wrap">
              {priorityOrder.map((p) => {
                const cfg = priorityConfig[p]
                const isActive = priority === p
                return (
                  <button
                    key={p}
                    onClick={() => setPriority(p)}
                    className={cn(
                      'flex items-center gap-1.5 h-7 px-2.5 rounded-lg text-xs font-medium transition-all duration-150 cursor-pointer',
                      isActive
                        ? 'bg-accent text-foreground ring-1 ring-border'
                        : 'text-muted-foreground hover:text-foreground hover:bg-accent/60'
                    )}
                  >
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: cfg.color }}
                    />
                    {cfg.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Assignee */}
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-2">指派人</label>
            <select
              value={assignee}
              onChange={(e) => setAssignee(e.target.value)}
              className="w-full h-8 px-2.5 text-xs border border-border rounded-lg bg-background outline-none focus:border-primary/30 transition-colors text-foreground cursor-pointer"
            >
              <option value="">未指定</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </div>

          {/* Estimated Hours */}
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-2">预估工天（天）</label>
            <input
              type="number"
              min="0"
              value={estimatedDays}
              onChange={(e) => setEstimatedDays(e.target.value)}
              placeholder="例：2"
              className="w-full h-8 px-2.5 text-xs border border-border rounded-lg bg-background outline-none focus:border-primary/30 transition-colors text-foreground"
            />
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-between pt-1">
            {confirmingDelete ? (
              <button
                onClick={handleDeleteClick}
                className="flex items-center gap-1.5 h-7 px-2.5 text-xs font-medium bg-destructive text-destructive-foreground rounded-lg hover:opacity-90 transition-opacity cursor-pointer"
              >
                <Trash2 className="w-3 h-3" /> 确认删除
              </button>
            ) : (
              <button
                onClick={handleDeleteClick}
                className="flex items-center gap-1.5 h-7 px-2 text-xs text-muted-foreground hover:text-destructive transition-colors cursor-pointer"
                title="删除任务"
                aria-label="删除任务"
              >
                <Trash2 className="w-3 h-3" /> 删除
              </button>
            )}
            <div className="flex items-center gap-1.5">
              <button
                onClick={handleCancel}
                className="flex items-center gap-1 h-7 px-2.5 text-xs text-muted-foreground hover:text-foreground border border-border rounded-lg hover:bg-accent transition-colors cursor-pointer"
              >
                <X className="w-3 h-3" /> 取消
              </button>
              <button
                onClick={handleSave}
                className="flex items-center gap-1 h-7 px-3 text-xs font-medium bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity cursor-pointer"
              >
                <Check className="w-3 h-3" /> 保存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export function TaskCardOverlay({ task }: { task: Task }) {
  const users = useCachedUsers()

  return (
    <div className="w-[17rem] bg-card border border-primary/30 rounded-xl overflow-hidden relative shadow-[0_18px_45px_rgba(0,0,0,.18)] ring-1 ring-primary/10 pointer-events-none">
      <TaskSummary task={task} users={users} isOverlay />
    </div>
  )
}
