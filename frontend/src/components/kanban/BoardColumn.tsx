import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import type { BoardColumn as BoardColumnType, Task } from '@ai-data-board/shared'
import { TaskCard } from './TaskCard'
import { Plus, Trash2 } from 'lucide-react'

interface BoardColumnProps {
  column: BoardColumnType
  tasks: Task[]
  onAddTask: () => void
  onDeleteColumn: () => void
  onTaskClick: (task: Task) => void
}

export function BoardColumn({ column, tasks, onAddTask, onDeleteColumn, onTaskClick }: BoardColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id })

  const sortedTasks = [...tasks].sort((a, b) => a.position - b.position)

  return (
    <div className="flex-shrink-0 w-72 flex flex-col bg-muted/30 rounded-xl">
      <div className="px-3.5 py-3 flex items-center justify-between border-b border-border/40">
        <div className="flex items-center gap-2 min-w-0">
          {column.color && (
            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: column.color }} />
          )}
          <h3 className="text-sm font-semibold truncate">{column.name}</h3>
          <span className="text-[11px] font-medium text-muted-foreground/60 tabular-nums">{tasks.length}</span>
        </div>
        <div className="flex items-center gap-0.5">
          <button onClick={onAddTask} className="p-1 hover:bg-accent rounded-lg transition-colors" title="添加任务">
            <Plus className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
          <button onClick={onDeleteColumn} className="p-1 hover:bg-accent rounded-lg transition-colors" title="删除列">
            <Trash2 className="w-3.5 h-3.5 text-muted-foreground/50 hover:text-destructive transition-colors" />
          </button>
        </div>
      </div>
      <div
        ref={setNodeRef}
        className={`flex-1 p-2 space-y-2 overflow-y-auto min-h-[80px] rounded-b-xl transition-colors ${isOver ? 'bg-accent/30' : ''}`}
      >
        <SortableContext items={sortedTasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
          {sortedTasks.map((task) => (
            <TaskCard key={task.id} task={task} onClick={() => onTaskClick(task)} />
          ))}
        </SortableContext>
      </div>
    </div>
  )
}
