import { Archive, Trash2, ArrowRight, ListTodo } from 'lucide-react'
import type { Project } from '@ai-data-board/shared'

interface Props {
  project: Project
  onClick: () => void
  onArchive: () => void
  onDelete: () => void
}

export function ProjectCard({ project, onClick, onArchive, onDelete }: Props) {
  const taskCount = project.taskCount ?? 0

  return (
    <div
      className="group relative border border-border/30 rounded-xl bg-card/80 hover:bg-card hover:border-border/60 hover:shadow-md transition-all duration-200 cursor-pointer h-[150px] overflow-hidden"
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick() } }}
    >
      {/* Left color accent bar */}
      {project.color && (
        <div
          className="absolute left-0 top-3 bottom-3 w-1 rounded-r-full opacity-70 group-hover:opacity-100 transition-opacity"
          style={{ backgroundColor: project.color }}
        />
      )}

      {/* Hover actions */}
      <div className="absolute top-2.5 right-2.5 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-all duration-150 z-10">
        <button
          onClick={(e) => { e.stopPropagation(); onArchive() }}
          className="p-1.5 rounded-md text-muted-foreground/50 hover:text-foreground hover:bg-accent transition-colors cursor-pointer"
          title="归档项目"
          aria-label="归档项目"
        >
          <Archive className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete() }}
          className="p-1.5 rounded-md text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
          title="删除项目"
          aria-label="删除项目"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
        <ArrowRight className="w-3.5 h-3.5 text-muted-foreground/20 ml-0.5" />
      </div>

      <div className="p-4 h-full flex flex-col">
        {/* Top row: name with color dot */}
        <div className="flex items-center gap-2 mb-3 pr-12">
          {project.color ? (
            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: project.color }} />
          ) : (
            <span className="w-2 h-2 rounded-full shrink-0 bg-muted-foreground/20" />
          )}
          <h3 className="text-sm font-semibold text-foreground/90 truncate leading-tight">
            {project.name}
          </h3>
        </div>

        {/* Task count */}
        <div className="flex items-center gap-1.5 mb-2">
          <ListTodo className="w-3.5 h-3.5 text-muted-foreground/50" />
          <span className="text-xs text-muted-foreground">
            {taskCount > 0 ? `${taskCount} 个任务` : '暂无任务'}
          </span>
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Bottom: members + task count badge */}
        <div className="flex items-center justify-between">
          {project.members && project.members.length > 0 ? (
            <div className="flex items-center gap-0.5">
              {project.members.slice(0, 3).map(m => (
                <div
                  key={m.id}
                  className="w-5.5 h-5.5 rounded-full bg-muted flex items-center justify-center text-[10px] font-medium text-muted-foreground ring-1 ring-border/40"
                  title={m.name}
                >
                  {m.name.charAt(0)}
                </div>
              ))}
              {project.members.length > 3 && (
                <span className="text-[10px] text-muted-foreground/60 ml-1">
                  +{project.members.length - 3}
                </span>
              )}
            </div>
          ) : (
            <span className="text-[10px] text-muted-foreground/40">未分配</span>
          )}
          {taskCount > 0 && (
            <span className="text-[10px] tabular-nums font-medium text-muted-foreground/50 bg-muted/50 px-1.5 py-0.5 rounded">
              {taskCount}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
