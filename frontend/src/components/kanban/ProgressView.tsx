import { useMemo } from 'react'
import { useBoard } from '../../contexts/BoardContext'
import type { Task, Priority } from '@ai-data-board/shared'

function parseDate(v: string | null) {
  if (!v) return null
  const d = new Date(v)
  return isNaN(d.getTime()) ? null : d
}

function dateKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function addDays(d: Date, n: number) {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

function diffDays(a: Date, b: Date) {
  return Math.round((b.getTime() - a.getTime()) / 86400000)
}

export function ProgressView() {
  const { state } = useBoard()

  const { dayCount, days, projectRows, today } = useMemo(() => {
    const now = new Date()
    const today = dateKey(now)

    // Collect all tasks with date ranges
    type TaskWithDates = Task & { start: Date; end: Date }
    const dated: TaskWithDates[] = []
    for (const t of state.tasks) {
      const start = parseDate(t.startDate)
      const end = parseDate(t.endDate)
      if (start && end) {
        dated.push({ ...t, start, end })
      }
    }

    if (dated.length === 0) {
      // Show a default 2-week window
      const from = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7)
      const to = addDays(from, 21)
      const days: string[] = []
      for (let d = new Date(from); d <= to; d = addDays(d, 1)) {
        days.push(dateKey(d))
      }
      return { dayCount: days.length, days, projectRows: [{ project: null, tasks: [] }] }
    }

    // Calculate date range
    let minDate = dated[0].start
    let maxDate = dated[0].end
    for (const t of dated) {
      if (t.start < minDate) minDate = t.start
      if (t.end > maxDate) maxDate = t.end
    }
    // Pad 3 days on each side
    const from = addDays(minDate, -3)
    const to = addDays(maxDate, 3)

    // Build day columns
    const days: string[] = []
    for (let d = new Date(from); d <= to; d = addDays(d, 1)) {
      days.push(dateKey(d))
    }

    // Group by project
    const projectMap = new Map(state.projects.map(p => [p.id, p]))
    const grouped = new Map<string | null, TaskWithDates[]>()
    for (const t of dated) {
      const pid = t.projectId
      if (!grouped.has(pid)) grouped.set(pid, [])
      grouped.get(pid)!.push(t)
    }

    const projectRows: { project: typeof state.projects[0] | null; tasks: TaskWithDates[] }[] = []
    for (const [pid, tasks] of grouped) {
      const project = pid ? projectMap.get(pid) ?? null : null
      projectRows.push({ project, tasks })
    }

    return { dayCount: days.length, days, projectRows, today }
  }, [state.tasks, state.projects])

  const dayWidth = 120

  const priorityColors: Record<Priority, string> = {
    urgent: '#ef4444',
    high: '#f97316',
    medium: '#3b82f6',
    low: '#9ca3af',
  }

  return (
    <div className="px-6 pt-2 pb-6" style={{ height: 'calc(100vh - 72px)' }}>
      <div className="bg-card border border-border/60 rounded-xl shadow-sm overflow-hidden h-full flex flex-col">
        {/* Toolbar */}
        <div className="flex items-center justify-between px-4 h-11 border-b border-border/40 shrink-0">
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-semibold">进度总览</span>
            <span className="text-[11px] text-muted-foreground">
              {state.projects.find(p => p.id === state.currentProjectId)?.name ?? '所有项目'}
            </span>
          </div>
        </div>

        {/* Gantt grid */}
        <div className="flex-1 overflow-auto">
          {projectRows.length === 0 || (projectRows.length === 1 && projectRows[0].project === null && projectRows[0].tasks.length === 0) ? (
            <div className="flex items-center justify-center h-full text-sm text-muted-foreground/60">
              暂无任务数据。为任务设置开始/结束日期后，进度图将在此显示。
            </div>
          ) : (
            <div
              className="grid min-w-full"
              style={{
                gridTemplateColumns: `260px repeat(${dayCount}, ${dayWidth}px)`,
              }}
            >
              {/* Header row: left header + day columns */}
              <div className="sticky top-0 z-10 bg-card flex">
                <div className="w-[260px] shrink-0 flex items-center h-8 px-3 text-[11px] font-semibold text-muted-foreground border-b border-r border-border/40" />
                <div className="flex" style={{ width: dayCount * dayWidth }}>
                  {days.map((d) => {
                    const isToday = d === today
                    return (
                      <div
                        key={d}
                        className={`flex flex-col items-center justify-center h-8 text-[11px] border-b border-l border-border/40 shrink-0 ${
                          isToday ? 'bg-foreground text-background font-bold rounded-full mx-1 my-1 h-6 border-0' : ''
                        }`}
                        style={{ width: dayWidth }}
                      >
                        {isToday ? '今天' : d.slice(5)}
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Rows */}
              {projectRows.map(({ project, tasks }) => (
                <div key={project?.id ?? '__orphan'}>
                  {/* Project header */}
                  <div className="flex">
                    <div className="w-[260px] shrink-0 flex items-center gap-2 h-9 px-3 bg-muted/30 border-b border-r border-border/40">
                      {project?.color && (
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: project.color }} />
                      )}
                      <span className="text-xs font-semibold truncate">{project?.name ?? '未归类'}</span>
                      <span className="text-[11px] text-muted-foreground ml-auto tabular-nums">{tasks.length}</span>
                    </div>
                    <div style={{ width: dayCount * dayWidth }} className="border-b border-border/40" />
                  </div>

                  {/* Task rows */}
                  {tasks.map((task) => {
                    const barStart = diffDays(days[0] ? new Date(days[0]) : task.start, task.start)
                    const barSpan = Math.max(diffDays(task.start, task.end), 0) + 1

                    return (
                      <div key={task.id} className="flex group">
                        <div className="w-[260px] shrink-0 flex items-center justify-between h-[42px] px-3 border-b border-r border-border/40">
                          <div className="min-w-0">
                            <p className="text-xs font-medium truncate">{task.title}</p>
                            <p className="text-[11px] text-muted-foreground">
                              {task.assignee ?? '-'} · {task.startDate?.slice(5) ?? '?'} ~ {task.endDate?.slice(5) ?? '?'}
                            </p>
                          </div>
                        </div>
                        <div className="relative flex h-[42px] border-b border-border/40" style={{ width: dayCount * dayWidth }}>
                          <div
                            className="absolute top-1/2 -translate-y-1/2 h-4 rounded-[4px] mx-1 shadow-sm"
                            style={{
                              left: `${(barStart / dayCount) * 100}%`,
                              width: `${(barSpan / dayCount) * 100}%`,
                              minWidth: 8,
                              backgroundColor: priorityColors[task.priority],
                            }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
