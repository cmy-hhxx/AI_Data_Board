import { useState, useEffect, useRef } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Task, Priority, User } from '@ai-data-board/shared'
import { X, Check, Trash2, Clock } from 'lucide-react'
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

// Module-level cache to avoid duplicate API calls across TaskCard instances
let usersCache: User[] | null = null
let usersLoading: Promise<User[]> | null = null

function UserAvatar({ name, size = 'sm' }: { name: string; size?: 'sm' | 'xs' }) {
  const initials = name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
  const sizeClass = size === 'xs' ? 'w-5 h-5 text-[9px]' : 'w-6 h-6 text-[10px]'
  return (
    <span className={cn('rounded-full bg-muted border border-border flex items-center justify-center font-semibold text-muted-foreground shrink-0', sizeClass)}>
      {initials}
    </span>
  )
}

export function TaskCard({ task, onUpdate, onDelete }: TaskCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [priority, setPriority] = useState<Priority>(task.priority)
  const [assignee, setAssignee] = useState(task.assignee || '')
  const [estimatedHours, setEstimatedHours] = useState(task.estimatedHours ?? '')
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [users, setUsers] = useState<User[]>(usersCache || [])
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

  const style = { transform: CSS.Transform.toString(transform), transition }

  const handleSave = () => {
    onUpdate(task.id, {
      priority,
      assignee: assignee || null,
      estimatedHours: estimatedHours === '' ? null : Number(estimatedHours),
    })
    setExpanded(false)
  }

  const handleCancel = () => {
    setPriority(task.priority)
    setAssignee(task.assignee || '')
    setEstimatedHours(task.estimatedHours ?? '')
    setConfirmingDelete(false)
    setExpanded(false)
  }

  const handleCardClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!isDragging && !expanded) setExpanded(true)
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

  const assignedUser = users.find(u => u.id === task.assignee)
  const priorityColor = priorityConfig[task.priority]?.color ?? priorityConfig.low.color

  return (
    <div
      ref={(node) => { setNodeRef(node); cardRef.current = node }}
      style={style}
      {...attributes}
      {...listeners}
      onClick={handleCardClick}
      className={cn(
        'bg-card border rounded-xl transition-all duration-150 overflow-hidden',
        'border-border shadow-[0_1px_2px_rgba(0,0,0,.05)]',
        isDragging
          ? 'opacity-40 scale-[0.97] shadow-lg border-primary/30'
          : 'hover:shadow-[0_3px_10px_rgba(0,0,0,.08)] hover:border-border/80',
        expanded
          ? 'cursor-default shadow-[0_4px_16px_rgba(0,0,0,.1)] border-border ring-1 ring-primary/10'
          : 'cursor-grab active:cursor-grabbing'
      )}
    >
      {/* Priority left border accent */}
      <div className="flex">
        <div
          className="w-0.5 shrink-0 rounded-l-xl"
          style={{ backgroundColor: priorityColor }}
        />

        {/* Collapsed content */}
        <div className="flex-1 px-3 py-3 min-w-0">
          <p className="text-sm font-medium leading-snug text-foreground">{task.title}</p>

          {/* Meta row */}
          {(task.assignee || task.estimatedHours != null) && (
            <div className="flex items-center gap-2.5 mt-2">
              {assignedUser && (
                <div className="flex items-center gap-1.5">
                  <UserAvatar name={assignedUser.name} size="xs" />
                  <span className="text-xs text-muted-foreground">{assignedUser.name}</span>
                </div>
              )}
              {task.estimatedHours != null && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="w-3 h-3" />
                  {task.estimatedHours}天
                </span>
              )}
            </div>
          )}
        </div>
      </div>

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
              value={estimatedHours}
              onChange={(e) => setEstimatedHours(e.target.value)}
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
