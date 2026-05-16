import { useState, useEffect } from 'react'
import type { Task, Tag } from '@ai-data-board/shared'
import { X, Trash2 } from 'lucide-react'
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
  { value: 'low', label: '低', color: 'bg-gray-400' },
  { value: 'medium', label: '中', color: 'bg-blue-500' },
  { value: 'high', label: '高', color: 'bg-orange-500' },
  { value: 'urgent', label: '紧急', color: 'bg-red-500' },
]

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
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16" onClick={onClose}>
      <div className="bg-card border rounded-xl shadow-2xl w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h3 className="font-semibold">任务详情</h3>
          <div className="flex items-center gap-1">
            <button onClick={onDelete} className="p-1.5 hover:bg-destructive/10 rounded transition-colors">
              <Trash2 className="w-4 h-4 text-muted-foreground hover:text-destructive" />
            </button>
            <button onClick={onClose} className="p-1.5 hover:bg-accent rounded transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full text-lg font-semibold px-2 py-1 border-0 border-b border-transparent hover:border-border focus:border-primary outline-none bg-transparent"
            placeholder="任务标题"
          />

          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">描述</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-2 py-1.5 text-sm border rounded-md resize-none min-h-[60px]"
              placeholder="添加描述..."
            />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-2">优先级</label>
            <div className="flex gap-2">
              {priorityOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setPriority(opt.value as Task['priority'])}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors ${priority === opt.value ? 'ring-2 ring-primary bg-accent' : 'hover:bg-accent'}`}
                >
                  <span className={`w-2 h-2 rounded-full ${opt.color}`} />
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">指派人</label>
              <input value={assignee} onChange={(e) => setAssignee(e.target.value)} className="w-full px-2 py-1.5 text-sm border rounded-md" placeholder="姓名..." />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">截止日期</label>
              <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="w-full px-2 py-1.5 text-sm border rounded-md" />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-muted-foreground">标签</label>
              <button onClick={() => setIsAddingTag(!isAddingTag)} className="text-xs text-primary hover:underline">
                + 新建
              </button>
            </div>
            {isAddingTag && (
              <div className="flex gap-1 mb-2">
                <input autoFocus value={newTagName} onChange={(e) => setNewTagName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') handleCreateTag(); if (e.key === 'Escape') setIsAddingTag(false) }} placeholder="标签名" className="flex-1 px-2 py-1 text-xs border rounded-md" />
                <button onClick={handleCreateTag} className="text-xs px-2 py-1 bg-primary text-primary-foreground rounded-md">添加</button>
              </div>
            )}
            <div className="flex flex-wrap gap-1.5">
              {tags.map((tag) => {
                const isActive = activeTagIds.includes(tag.id)
                return (
                  <button
                    key={tag.id}
                    onClick={() => toggleTag(tag.id)}
                    className={`text-xs px-2 py-1 rounded-full border transition-all ${isActive ? 'ring-1 ring-primary bg-accent' : 'hover:bg-accent'}`}
                    style={{ borderColor: tag.color || '#e5e7eb' }}
                    onDoubleClick={() => onTagDeleted(tag.id)}
                  >
                    {tag.name}
                  </button>
                )
              })}
              {tags.length === 0 && <span className="text-xs text-muted-foreground">暂无标签，点击"+ 新建"创建</span>}
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">点击切换标签，双击删除标签</p>
          </div>
        </div>

        <div className="px-5 py-3 border-t flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-1.5 text-sm rounded-md hover:bg-accent transition-colors">取消</button>
          <button onClick={handleSave} className="px-4 py-1.5 text-sm bg-primary text-primary-foreground rounded-md hover:opacity-90 transition-colors">保存</button>
        </div>
      </div>
    </div>
  )
}
