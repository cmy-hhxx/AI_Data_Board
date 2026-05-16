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
    <div className="flex-shrink-0 w-72 flex flex-col bg-muted/30 rounded-lg">
      <div className="px-3 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: column.color || '#6b7280' }} />
          <h3 className="text-sm font-semibold">{column.name}</h3>
          <span className="text-xs text-muted-foreground">{tasks.length}</span>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={onAddTask} className="p-1 hover:bg-accent rounded transition-colors">
            <Plus className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
          <button onClick={onDeleteColumn} className="p-1 hover:bg-destructive/10 rounded transition-colors">
            <Trash2 className="w-3.5 h-3.5 text-muted-foreground hover:text-destructive" />
          </button>
        </div>
      </div>
      <div
        ref={setNodeRef}
        className={`flex-1 p-2 space-y-2 overflow-y-auto min-h-[100px] rounded-b-lg transition-colors ${isOver ? 'bg-accent/50' : ''}`}
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
