import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Task } from '@ai-data-board/shared'
import { Calendar, User } from 'lucide-react'
import { cn } from '../../lib/utils'

interface TaskCardProps {
  task: Task
  onClick: () => void
}

const priorityBar: Record<string, string> = {
  urgent: 'bg-red-500',
  high: 'bg-orange-400',
  medium: 'bg-blue-500',
  low: 'bg-gray-300',
}

export function TaskCard({ task, onClick }: TaskCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { task },
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className={cn(
        'bg-card border border-border/70 rounded-xl p-3.5 cursor-grab active:cursor-grabbing shadow-[0_1px_3px_rgba(0,0,0,.04)] hover:shadow-[0_4px_12px_rgba(0,0,0,.08)] transition-all duration-150',
        isDragging && 'opacity-50 shadow-lg'
      )}
    >
      {/* Priority indicator bar */}
      <div className={cn('h-0.5 w-8 rounded-full mb-2.5', priorityBar[task.priority])} />

      <p className="text-sm font-medium leading-snug text-foreground/90">{task.title}</p>

      {(task.dueDate || task.assignee) && (
        <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground/70">
          {task.dueDate && (
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {task.dueDate}
            </span>
          )}
          {task.assignee && (
            <span className="flex items-center gap-1">
              <User className="w-3 h-3" />
              {task.assignee}
            </span>
          )}
        </div>
      )}
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
  )
}
