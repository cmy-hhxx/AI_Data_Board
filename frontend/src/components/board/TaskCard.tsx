import { useState, useEffect, useRef, type ButtonHTMLAttributes, type MouseEvent as ReactMouseEvent } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Task, Priority, User } from '@ai-data-board/shared'
import { X, Check, Trash2, Clock, AlertCircle, GripVertical } from 'lucide-react'
import { cn } from '../../lib/utils'

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

// Avatar colors — cool-toned, uniform saturation so avatars look
// cohesive across the board rather than a random rainbow.
const avatarColors = [
  '#5b8fd9', '#4db8a8', '#8478cc', '#4daacd', '#5ba87e',
  '#7888cc', '#4db5bc', '#6d9ec4', '#7a9e8e', '#8898c0',
]

function UserAvatar({ name, size = 'sm' }: { name: string; size?: 'sm' | 'xs' }) {
  const initials = name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
  const sizeClass = size === 'xs' ? 'w-5 h-5 text-[9px]' : 'w-6 h-6 text-[10px]'
  const color = avatarColors[getStringHash(name) % avatarColors.length]

  return (
    <span
      className={cn('rounded-full flex items-center justify-center font-bold text-white shrink-0 shadow-sm ring-2 ring-background', sizeClass)}
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

function StackedAvatars({ names, max = 3 }: { names: string[]; max?: number }) {
  const visible = names.slice(0, max)
  const overflow = names.length - max

  return (
    <div className="flex items-center">
      {visible.map((name, i) => (
        <span key={name} style={{ marginLeft: i > 0 ? '-4px' : 0, zIndex: visible.length - i }}>
          <UserAvatar name={name} size="xs" />
        </span>
      ))}
      {overflow > 0 && (
        <span
          className="w-5 h-5 rounded-full bg-muted text-[9px] font-bold flex items-center justify-center text-muted-foreground ring-2 ring-background"
          style={{ marginLeft: '-4px', zIndex: 0 }}
        >
          +{overflow}
        </span>
      )}
    </div>
  )
}

function TaskSummary({
  task,
  dragHandleProps,
  isOverlay = false,
  titleValue,
  onTitleChange,
}: {
  task: Task
  dragHandleProps?: ButtonHTMLAttributes<HTMLButtonElement>
  isOverlay?: boolean
  titleValue?: string
  onTitleChange?: (value: string) => void
}) {
  const names = task.assignees.map(u => u.name)
  const editing = onTitleChange !== undefined

  const handleDragButtonClick = (event: ReactMouseEvent<HTMLButtonElement>) => {
    event.preventDefault()
    event.stopPropagation()
    dragHandleProps?.onClick?.(event)
  }

  return (
    <div className="px-3 py-3 min-w-0">
      <div className="flex items-start gap-2 min-w-0">
        {editing ? (
          <input
            type="text"
            value={titleValue}
            onChange={(e) => onTitleChange(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            className="flex-1 text-sm font-medium leading-snug text-foreground min-w-0 bg-transparent outline-none focus-visible:outline-none"
          />
        ) : (
          <p className="flex-1 text-sm font-medium leading-snug text-foreground min-w-0 break-words">{task.title}</p>
        )}
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

      <div className="flex items-center gap-2.5 mt-2 min-w-0">
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          {names.length > 0 ? (
            <>
              <StackedAvatars names={names} />
              <span className="text-xs text-muted-foreground truncate">
                {names.join(', ')}
              </span>
            </>
          ) : (
            <>
              <span
                className="w-5 h-5 rounded-full border border-dashed border-muted-foreground/40 shrink-0"
                aria-hidden
              />
              <span className="text-xs text-muted-foreground/50">未指派</span>
            </>
          )}
        </div>
        {task.estimatedDays != null && (
          <span className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
            <Clock className="w-3 h-3" />
            {task.estimatedDays}天
          </span>
        )}
        {task.blocker && (
          <span className="flex items-center gap-1 text-xs text-amber-600 min-w-0 shrink-0 max-w-[7rem]">
            <AlertCircle className="w-3 h-3 shrink-0" />
            <span className="truncate">{task.blocker.length > 6 ? task.blocker.slice(0, 6) + '…' : task.blocker}</span>
          </span>
        )}
      </div>
    </div>
  )
}

function AssigneeTagInput({
  names,
  onChange,
}: {
  names: string[]
  onChange: (names: string[]) => void
}) {
  const [input, setInput] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const addNames = (text: string) => {
    const parts = text.split(/[,，]/).map(s => s.trim()).filter(s => s.length > 0 && !names.includes(s))
    if (parts.length > 0) onChange([...names, ...parts])
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      addNames(input)
      setInput('')
    } else if (e.key === 'Backspace' && input === '' && names.length > 0) {
      onChange(names.slice(0, -1))
    }
  }

  const handleBlur = () => {
    if (input.trim()) {
      addNames(input)
      setInput('')
    }
  }

  const handleRemove = (name: string) => {
    onChange(names.filter(n => n !== name))
  }

  return (
    <div
      className="flex flex-wrap items-center gap-1.5 min-h-[2rem] p-1.5 text-xs border border-border rounded-lg bg-background cursor-text focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary/30"
      onClick={() => inputRef.current?.focus()}
    >
      {names.map(name => (
        <span
          key={name}
          className="inline-flex items-center gap-1 h-6 pl-1 pr-1.5 text-xs bg-accent rounded-md border border-border"
        >
          <UserAvatar name={name} size="xs" />
          <span className="text-foreground">{name}</span>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); handleRemove(name) }}
            className="ml-0.5 rounded-full p-0.5 hover:bg-muted transition-colors cursor-pointer"
          >
            <X className="w-2.5 h-2.5 text-muted-foreground" />
          </button>
        </span>
      ))}
      <input
        ref={inputRef}
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        placeholder={names.length > 0 ? '继续添加…' : '输入人名，回车确认'}
        className="flex-1 min-w-[6rem] h-6 bg-transparent outline-none focus-visible:outline-none text-foreground placeholder:text-muted-foreground/50"
      />
    </div>
  )
}

export function TaskCard({ task, onUpdate, onDelete }: TaskCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [title, setTitle] = useState(task.title)
  const [priority, setPriority] = useState<Priority>(task.priority)
  const [assigneeNames, setAssigneeNames] = useState<string[]>(task.assignees.map(u => u.name))
  const [estimatedDays, setEstimatedDays] = useState(task.estimatedDays ?? '')
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)

  // Sync state when task changes (e.g. from remote update) and card is collapsed
  useEffect(() => {
    if (!expanded) {
      setTitle(task.title)
      setPriority(task.priority)
      setAssigneeNames(task.assignees.map(u => u.name))
      setEstimatedDays(task.estimatedDays ?? '')
    }
  }, [task, expanded])

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
      title,
      priority,
      assigneeNames,
      estimatedDays: estimatedDays === '' ? null : Number(estimatedDays),
    })
    setExpanded(false)
  }

  const handleCancel = () => {
    setTitle(task.title)
    setPriority(task.priority)
    setAssigneeNames(task.assignees.map(u => u.name))
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
          ? 'cursor-default shadow-[0_4px_16px_rgba(0,0,0,.1)] border-border ring-1 ring-primary/10 z-50'
          : !isDragging && 'cursor-pointer'
      )}
    >
      <TaskSummary task={task} dragHandleProps={{ ...attributes, ...listeners }} titleValue={title} onTitleChange={expanded ? setTitle : undefined} />

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

          {/* Assignee tag input */}
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-2">指派人</label>
            <AssigneeTagInput
              names={assigneeNames}
              onChange={setAssigneeNames}
            />
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
              className="w-full h-8 px-2.5 text-xs border border-border rounded-lg bg-background outline-none focus-visible:outline-none focus:border-primary/30 focus:ring-2 focus:ring-primary/20 transition-colors text-foreground"
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
  return (
    <div className="w-[17rem] bg-card border border-primary/30 rounded-xl overflow-hidden relative shadow-[0_18px_45px_rgba(0,0,0,.18)] ring-1 ring-primary/10 pointer-events-none">
      <TaskSummary task={task} isOverlay />
    </div>
  )
}
