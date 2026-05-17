import { useState, useEffect } from 'react'
import type { Task, Tag } from '@ai-data-board/shared'
import { X, Trash2 } from 'lucide-react'
import { cn } from '../../lib/utils'
import { api } from '../../lib/api'

interface TaskDetailDialogProps {
  task: Task
  tags: Tag[]
  selectedTagIds: string[]
  onClose: () => void
  onUpdate: (data: Record<string, unknown>) => void
  onDelete: () => void
  onTagCreated: (tag: Tag) => void
  onTagDeleted: (tagId: string) => void
}

const priorityOptions = [
  { value: 'low', label: '低', color: 'bg-gray-300' },
  { value: 'medium', label: '中', color: 'bg-blue-500' },
  { value: 'high', label: '高', color: 'bg-orange-400' },
  { value: 'urgent', label: '紧急', color: 'bg-red-500' },
] as const

export function TaskDetailDialog({ task, tags, selectedTagIds, onClose, onUpdate, onDelete, onTagCreated, onTagDeleted }: TaskDetailDialogProps) {
  const [title, setTitle] = useState(task.title)
  const [description, setDescription] = useState(task.description || '')
  const [priority, setPriority] = useState(task.priority)
  const [assignee, setAssignee] = useState(task.assignee || '')
  const [dueDate, setDueDate] = useState(task.dueDate || '')
  const [activeTagIds, setActiveTagIds] = useState<string[]>(selectedTagIds)
  const [newTagName, setNewTagName] = useState('')
  const [isAddingTag, setIsAddingTag] = useState(false)

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [onClose])

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
    onUpdate({
      title,
      description: description || null,
      priority,
      assignee: assignee || null,
      dueDate: dueDate || null,
      tagIds: activeTagIds,
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] bg-black/20 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-card border border-border/80 rounded-2xl shadow-2xl w-full max-w-lg mx-4" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-3">
          <h3 className="text-sm font-semibold tracking-tight">任务详情</h3>
          <div className="flex items-center gap-0.5">
            <button onClick={onDelete} className="p-1.5 rounded-lg hover:bg-accent transition-colors" title="删除">
              <Trash2 className="w-4 h-4 text-muted-foreground/60 hover:text-destructive transition-colors" />
            </button>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-accent transition-colors" title="关闭">
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 pb-2 space-y-5 max-h-[65vh] overflow-y-auto">
          {/* Title */}
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full text-lg font-semibold px-0 py-1 border-0 border-b-2 border-transparent hover:border-border/50 focus:border-foreground/20 outline-none bg-transparent transition-colors"
            placeholder="任务标题"
          />

          {/* Description */}
          <div>
            <label className="text-[11px] font-medium text-muted-foreground/70 tracking-wide uppercase block mb-1.5">描述</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-border/70 rounded-xl resize-none min-h-[60px] bg-background outline-none focus:border-foreground/20 transition-colors"
              placeholder="添加描述..."
              rows={3}
            />
          </div>

          {/* Priority */}
          <div>
            <label className="text-[11px] font-medium text-muted-foreground/70 tracking-wide uppercase block mb-2">优先级</label>
            <div className="flex gap-1.5">
              {priorityOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setPriority(opt.value as Task['priority'])}
                  className={cn(
                    'flex items-center gap-1.5 h-8 px-3 rounded-lg text-sm transition-all',
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

          {/* Assignee + Due Date */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[11px] font-medium text-muted-foreground/70 tracking-wide uppercase block mb-1.5">指派人</label>
              <input
                value={assignee}
                onChange={(e) => setAssignee(e.target.value)}
                className="w-full h-9 px-3 text-sm border border-border/70 rounded-xl bg-background outline-none focus:border-foreground/20 transition-colors"
                placeholder="姓名..."
              />
            </div>
            <div>
              <label className="text-[11px] font-medium text-muted-foreground/70 tracking-wide uppercase block mb-1.5">截止日期</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full h-9 px-3 text-sm border border-border/70 rounded-xl bg-background outline-none focus:border-foreground/20 transition-colors"
              />
            </div>
          </div>

          {/* Tags */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[11px] font-medium text-muted-foreground/70 tracking-wide uppercase">标签</label>
              <button onClick={() => setIsAddingTag(!isAddingTag)} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                + 新建
              </button>
            </div>
            {isAddingTag && (
              <div className="flex gap-1.5 mb-2.5">
                <input
                  autoFocus
                  value={newTagName}
                  onChange={(e) => setNewTagName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleCreateTag(); if (e.key === 'Escape') setIsAddingTag(false) }}
                  placeholder="标签名"
                  className="flex-1 h-8 px-2.5 text-xs border border-border/70 rounded-lg bg-background outline-none"
                />
                <button onClick={handleCreateTag} className="h-8 px-3 text-xs font-medium bg-foreground text-background rounded-lg">添加</button>
              </div>
            )}
            <div className="flex flex-wrap gap-1.5">
              {tags.map((tag) => {
                const isActive = activeTagIds.includes(tag.id)
                return (
                  <button
                    key={tag.id}
                    onClick={() => toggleTag(tag.id)}
                    className={cn(
                      'text-xs font-medium h-7 px-2.5 rounded-full border transition-all',
                      isActive
                        ? 'bg-foreground text-background border-foreground'
                        : 'text-muted-foreground border-border/70 hover:border-foreground/30 hover:text-foreground'
                    )}
                    onDoubleClick={() => onTagDeleted(tag.id)}
                  >
                    {tag.name}
                  </button>
                )
              })}
              {tags.length === 0 && <span className="text-xs text-muted-foreground/60 py-1">暂无标签</span>}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border/50">
          <button onClick={onClose} className="h-8 px-4 text-sm text-muted-foreground hover:text-foreground transition-colors">取消</button>
          <button onClick={handleSave} className="h-8 px-5 text-sm font-medium bg-foreground text-background rounded-lg hover:opacity-90 transition-opacity">保存</button>
        </div>
      </div>
    </div>
  )
}
