import { useState } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Task, Tag, Priority } from '@ai-data-board/shared'
import { CalendarDays, Check, Flag, User, X } from 'lucide-react'
import { cn } from '../../lib/utils'
import { api } from '../../lib/api'

interface TaskCardProps {
  task: Task
  tags: Tag[]
  onUpdate: (taskId: string, data: Record<string, unknown>) => void
  onDelete: (taskId: string) => void
  onTagCreated: (tag: Tag) => void
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

const priorityLabel: Record<Priority, string> = {
  urgent: '紧急',
  high: '高',
  medium: '中',
  low: '低',
}

function formatShortDate(value: string | null) {
  if (!value) return '无截止'
  return value.slice(5)
}

function deadlineTone(value: string | null) {
  if (!value) return 'text-muted-foreground/55 bg-muted/60'
  const today = new Date()
  const due = new Date(value)
  today.setHours(0, 0, 0, 0)
  due.setHours(0, 0, 0, 0)
  if (due.getTime() < today.getTime()) return 'text-red-600 bg-red-50'
  if (due.getTime() === today.getTime()) return 'text-orange-600 bg-orange-50'
  return 'text-muted-foreground bg-muted/70'
}

export function TaskCard({ task, tags, onUpdate, onTagCreated }: TaskCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [priority, setPriority] = useState<Priority>(task.priority)
  const [assignee, setAssignee] = useState(task.assignee || '')
  const [endDate, setEndDate] = useState(task.endDate || '')
  const [activeTagIds, setActiveTagIds] = useState<string[]>(task.tags?.map(t => t.id) || [])
  const [newTagName, setNewTagName] = useState('')
  const [isAddingTag, setIsAddingTag] = useState(false)

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { task },
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const toggleTag = (tagId: string) => {
    setActiveTagIds(prev => prev.includes(tagId) ? prev.filter(id => id !== tagId) : [...prev, tagId])
  }

  const handleCreateTag = async () => {
    if (!newTagName.trim()) return
    const tag = await api.tags.create({ name: newTagName.trim() })
    onTagCreated(tag)
    setActiveTagIds(prev => [...prev, tag.id])
    setNewTagName('')
    setIsAddingTag(false)
  }

  const handleSave = () => {
    const nextStartDate = task.startDate && endDate && task.startDate > endDate ? endDate : task.startDate
    onUpdate(task.id, {
      priority,
      assignee: assignee || null,
      startDate: nextStartDate || null,
      endDate: endDate || null,
      tagIds: activeTagIds,
    })
    setExpanded(false)
  }

  const handleCancel = () => {
    setPriority(task.priority)
    setAssignee(task.assignee || '')
    setEndDate(task.endDate || '')
    setActiveTagIds(task.tags?.map(t => t.id) || [])
    setNewTagName('')
    setIsAddingTag(false)
    setExpanded(false)
  }

  const handleEndDateChange = (value: string) => {
    setEndDate(value)
  }

  const handleCardClick = (e: React.MouseEvent) => {
    // Don't expand when dragging
    e.stopPropagation()
    if (!isDragging) {
      setExpanded(true)
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

        <div className="flex flex-wrap items-center gap-1.5 mt-2.5 text-[11px]">
          <span className="inline-flex items-center gap-1 h-5 px-1.5 rounded-md bg-muted/70 text-muted-foreground">
            <User className="w-3 h-3" />
            {task.assignee || '未指派'}
          </span>
          <span className="inline-flex items-center gap-1 h-5 px-1.5 rounded-md bg-muted/70 text-muted-foreground">
            <Flag className="w-3 h-3" />
            {priorityLabel[task.priority]}
          </span>
          <span className={cn('inline-flex items-center gap-1 h-5 px-1.5 rounded-md', deadlineTone(task.endDate))}>
            <CalendarDays className="w-3 h-3" />
            {formatShortDate(task.endDate)}
          </span>
        </div>

        {task.tags && task.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2.5">
            {task.tags.map((tag) => (
              <span
                key={tag.id}
                className="text-[10px] font-medium px-2 py-0.5 rounded-full"
                style={{ backgroundColor: (tag.color || '#e5e7eb') + '25', color: tag.color || '#6b7280' }}
              >
                {tag.name}
              </span>
            ))}
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
            <input
              value={assignee}
              onChange={(e) => setAssignee(e.target.value)}
              className="w-full h-7 px-2.5 text-xs border border-border/70 rounded-lg bg-background outline-none focus:border-foreground/20 transition-colors"
              placeholder="姓名..."
            />
          </div>

          {/* Dates */}
          <div>
            <label className="text-[10px] font-medium text-muted-foreground/70 tracking-wide uppercase block mb-1.5">截止时间</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => handleEndDateChange(e.target.value)}
              className="w-full h-7 px-2.5 text-xs border border-border/70 rounded-lg bg-background outline-none focus:border-foreground/20 transition-colors"
            />
          </div>

          {/* Tags */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[10px] font-medium text-muted-foreground/70 tracking-wide uppercase">标签</label>
              <button onClick={() => setIsAddingTag(!isAddingTag)} className="text-[10px] text-muted-foreground hover:text-foreground transition-colors">
                + 新建
              </button>
            </div>
            {isAddingTag && (
              <div className="flex gap-1 mb-1.5">
                <input
                  autoFocus
                  value={newTagName}
                  onChange={(e) => setNewTagName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleCreateTag(); if (e.key === 'Escape') setIsAddingTag(false) }}
                  placeholder="标签名"
                  className="flex-1 h-6 px-2 text-[11px] border border-border/70 rounded bg-background outline-none"
                />
                <button onClick={handleCreateTag} className="h-6 px-2 text-[11px] font-medium bg-foreground text-background rounded">添加</button>
              </div>
            )}
            <div className="flex flex-wrap gap-1">
              {tags.map((tag) => {
                const isActive = activeTagIds.includes(tag.id)
                return (
                  <button
                    key={tag.id}
                    onClick={() => toggleTag(tag.id)}
                    className={cn(
                      'text-[10px] font-medium h-5 px-2 rounded-full border transition-all',
                      isActive
                        ? 'bg-foreground text-background border-foreground'
                        : 'text-muted-foreground border-border/70 hover:border-foreground/30 hover:text-foreground'
                    )}
                  >
                    {tag.name}
                  </button>
                )
              })}
              {tags.length === 0 && <span className="text-[10px] text-muted-foreground/60">暂无标签</span>}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-1.5 pt-1">
            <button onClick={handleCancel} className="flex items-center gap-0.5 h-6 px-2 text-[11px] text-muted-foreground hover:text-foreground transition-colors">
              <X className="w-3 h-3" /> 取消
            </button>
            <button onClick={handleSave} className="flex items-center gap-0.5 h-6 px-3 text-[11px] font-medium bg-foreground text-background rounded-md hover:opacity-90 transition-opacity">
              <Check className="w-3 h-3" /> 确认
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
