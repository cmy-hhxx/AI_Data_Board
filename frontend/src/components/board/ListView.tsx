import { useMemo, useState, useEffect, useCallback } from 'react'
import { useBoard } from '../../contexts/BoardContext'
import { api } from '../../lib/api'
import type { Task, BoardColumn } from '@ai-data-board/shared'
import { X, AlertCircle, ChevronRight, ChevronDown } from 'lucide-react'
import { cn } from '../../lib/utils'

interface ListViewProps {
  onTaskUpdate: (taskId: string, data: Record<string, unknown>) => Promise<void>
}

const PERSON_COLORS = [
  '#3b82f6', '#10b981', '#06b6d4', '#ec4899', '#14b8a6',
  '#84cc16', '#6366f1', '#0ea5e9', '#22c55e', '#0891b2',
]

const PRIORITY_COLOR: Record<string, string> = {
  urgent: 'hsl(var(--priority-urgent))',
  high: 'hsl(var(--priority-high))',
  medium: 'hsl(var(--priority-medium))',
  low: 'hsl(var(--priority-low))',
}

const PRIORITY_LABEL: Record<string, string> = {
  urgent: '紧急', high: '高', medium: '中', low: '低',
}

function isCompletedColumn(col: BoardColumn): boolean {
  const name = col.name.toLowerCase()
  return name.includes('完成') || name.includes('done') || name.includes('completed')
}

function daysBetween(d1: Date, d2: Date): number {
  return Math.max(1, Math.ceil((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24)))
}

function parseDate(v: string | null | undefined): Date | null {
  if (!v) return null
  const d = new Date(v)
  return isNaN(d.getTime()) ? null : d
}

interface Lane {
  personId: string
  personName: string
  tasks: Task[]
  color: string
}

interface TaskPillProps {
  task: Task
  isCompleted: boolean
  onClick: () => void
}

function TaskPill({ task, isCompleted, onClick }: TaskPillProps) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const daysInCol = task.columnEnteredAt
    ? daysBetween(new Date(task.columnEnteredAt), new Date())
    : null

  const isOverdue = !isCompleted && task.endDate
    ? (() => { const end = parseDate(task.endDate); return end != null && end < today })()
    : false

  const hasBlocker = !!(task.blocker?.trim())
  const priorityColor = PRIORITY_COLOR[task.priority] ?? PRIORITY_COLOR.low

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-left',
        'transition-all duration-150 hover:shadow-sm cursor-pointer',
        isOverdue
          ? 'bg-red-50 border-red-200'
          : isCompleted
            ? 'bg-muted/20 border-border/40'
            : 'bg-card border-border hover:border-border/70',
      )}
    >
      <span
        className="w-1.5 h-1.5 rounded-full shrink-0"
        style={{ backgroundColor: priorityColor }}
      />
      <span className={cn(
        'flex-1 truncate min-w-0 text-xs font-medium',
        isCompleted ? 'text-muted-foreground/60 line-through' : 'text-foreground',
      )}>
        {task.title}
      </span>
      {daysInCol != null && daysInCol > 1 && (
        <span className="shrink-0 text-[10px] text-muted-foreground/50 tabular-nums">{daysInCol}天</span>
      )}
      {hasBlocker && (
        <AlertCircle className="w-3 h-3 shrink-0 text-amber-500" />
      )}
    </button>
  )
}

export function ListView({ onTaskUpdate }: ListViewProps) {
  const { state } = useBoard()
  const [popover, setPopover] = useState<{ task: Task; color: string } | null>(null)
  const [blockerValue, setBlockerValue] = useState('')
  const [collapsedLanes, setCollapsedLanes] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem('listview-collapsed-lanes')
      if (stored) return new Set(JSON.parse(stored))
    } catch { /* ignore */ }
    return new Set<string>()
  })

  const currentProject = state.projects.find(p => p.id === state.currentProjectId) ?? null

  const projectTasks = useMemo(
    () => state.tasks.filter(t => t.projectId === state.currentProjectId),
    [state.tasks, state.currentProjectId],
  )

  const sortedColumns = useMemo(
    () => [...state.columns].sort((a, b) => a.position - b.position),
    [state.columns],
  )

  const completedColIds = useMemo(
    () => new Set(sortedColumns.filter(isCompletedColumn).map(c => c.id)),
    [sortedColumns],
  )

  const lanes = useMemo<Lane[]>(() => {
    const grouped = new Map<string, { tasks: Task[]; color: string; name: string }>()
    for (const task of projectTasks) {
      if (task.assignees.length === 0) {
        const key = '__unassigned__'
        if (!grouped.has(key)) grouped.set(key, { tasks: [], color: '#9CA3AF', name: '待认领' })
        grouped.get(key)!.tasks.push(task)
      } else {
        for (const user of task.assignees) {
          const key = user.id
          if (!grouped.has(key)) {
            const colorIdx = grouped.size
            grouped.set(key, { tasks: [], color: PERSON_COLORS[colorIdx % PERSON_COLORS.length], name: user.name })
          }
          grouped.get(key)!.tasks.push(task)
        }
      }
    }
    return [...grouped.entries()]
      .map(([id, data]) => ({
        personId: id,
        personName: data.name,
        tasks: data.tasks.sort((a, b) => a.position - b.position),
        color: data.color,
      }))
      .sort((a, b) => {
        if (a.personId === '__unassigned__') return 1
        if (b.personId === '__unassigned__') return -1
        return b.tasks.length - a.tasks.length
      })
  }, [projectTasks])

  const completedCount = projectTasks.filter(t => t.columnId && completedColIds.has(t.columnId)).length
  const totalCount = projectTasks.length
  const completionPct = totalCount === 0 ? 0 : Math.round((completedCount / totalCount) * 100)

  const handleTaskClick = useCallback((task: Task, color: string) => {
    setPopover({ task, color })
    setBlockerValue(task.blocker ?? '')
  }, [])

  const handleBlockerSave = useCallback(async () => {
    if (!popover) return
    await onTaskUpdate(popover.task.id, { blocker: blockerValue.trim() || null })
    setPopover(null)
  }, [popover, blockerValue, onTaskUpdate])

  const handlePopoverClose = useCallback(() => setPopover(null), [])

  useEffect(() => {
    localStorage.setItem('listview-collapsed-lanes', JSON.stringify([...collapsedLanes]))
  }, [collapsedLanes])

  const toggleLane = useCallback((personId: string) => {
    setCollapsedLanes(prev => {
      const next = new Set(prev)
      if (next.has(personId)) next.delete(personId)
      else next.add(personId)
      return next
    })
  }, [])

  if (!currentProject) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
        请先选择一个项目
      </div>
    )
  }

  if (totalCount === 0) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
        当前项目暂无任务
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* ── Stats header ── */}
      <div className="shrink-0 px-6 py-3.5 border-b border-border flex items-center gap-5 bg-card/50">
        <span className="text-sm font-semibold text-foreground">{currentProject.name}</span>

        <div className="flex items-center gap-3 flex-1 max-w-sm">
          <div className="flex-1 h-2.5 bg-muted rounded-full overflow-hidden flex">
            {(['urgent', 'high', 'medium', 'low'] as const).map(p => {
              const count = projectTasks.filter(t => t.priority === p && t.columnId && completedColIds.has(t.columnId)).length
              if (count === 0) return null
              const widthPct = totalCount === 0 ? 0 : (count / totalCount) * 100
              return (
                <div
                  key={p}
                  className="h-full transition-all duration-500 first:rounded-l-full last:rounded-r-full"
                  style={{ width: `${widthPct}%`, backgroundColor: PRIORITY_COLOR[p] }}
                  title={`${PRIORITY_LABEL[p]}: ${count} 完成`}
                />
              )
            })}
          </div>
          <span className="text-xs text-muted-foreground shrink-0 tabular-nums font-medium">
            {completionPct}%
          </span>
          <span className="text-[11px] text-muted-foreground/60 shrink-0">
            {completedCount}/{totalCount}
          </span>
        </div>

        {/* Priority breakdown */}
        <div className="hidden md:flex items-center gap-4 text-xs text-muted-foreground">
          {(['urgent', 'high', 'medium', 'low'] as const).map(p => {
            const count = projectTasks.filter(t => t.priority === p).length
            if (count === 0) return null
            return (
              <span key={p} className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: PRIORITY_COLOR[p] }} />
                {PRIORITY_LABEL[p]} · {count}
              </span>
            )
          })}
        </div>

        {/* Collapse / Expand all */}
        <div className="flex items-center gap-0.5 ml-auto">
          <button
            type="button"
            onClick={() => setCollapsedLanes(new Set(lanes.map(l => l.personId)))}
            className="p-1 rounded hover:bg-accent text-muted-foreground/60 hover:text-foreground transition-colors cursor-pointer"
            title="全部折叠"
            aria-label="全部折叠"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setCollapsedLanes(new Set())}
            className="p-1 rounded hover:bg-accent text-muted-foreground/60 hover:text-foreground transition-colors cursor-pointer"
            title="全部展开"
            aria-label="全部展开"
          >
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* ── Swimlane table ── */}
      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse min-w-[480px]">
          {/* Column headers */}
          <thead className="sticky top-0 z-10">
            <tr>
              <th className="sticky left-0 z-20 bg-muted/80 backdrop-blur-sm border-b border-r border-border px-4 py-2.5 text-left w-28 min-w-[7rem]">
                <span className="text-xs font-medium text-muted-foreground">负责人</span>
              </th>
              {sortedColumns.map((col) => {
                const count = projectTasks.filter(t => t.columnId === col.id).length
                const isDone = isCompletedColumn(col)
                return (
                  <th
                    key={col.id}
                    className="border-b border-r border-border bg-muted/80 backdrop-blur-sm px-3 py-2.5 text-left min-w-[160px]"
                  >
                    <div className="flex items-center gap-2">
                      <span className={cn('text-xs font-medium', isDone ? 'text-emerald-600' : 'text-foreground')}>
                        {col.name}
                      </span>
                      {count > 0 && (
                        <span className="text-[11px] text-muted-foreground tabular-nums bg-border/60 rounded px-1">
                          {count}
                        </span>
                      )}
                    </div>
                  </th>
                )
              })}
            </tr>
          </thead>

          {/* Assignee rows */}
          <tbody>
            {lanes.map((lane, laneIdx) => {
              const isCollapsed = collapsedLanes.has(lane.personId)
              return (
                <tr key={lane.personId} className={laneIdx % 2 === 0 ? 'bg-background' : 'bg-muted/10'}>
                  {isCollapsed ? (
                    <td
                      colSpan={sortedColumns.length + 1}
                      className="sticky left-0 border-b border-border px-4 py-2 bg-inherit z-10"
                    >
                      <button
                        type="button"
                        onClick={() => toggleLane(lane.personId)}
                        className="flex items-center gap-2 w-full text-left cursor-pointer group"
                      >
                        <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/60 group-hover:text-foreground transition-colors" />
                        <span
                          className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[9px] font-bold shrink-0"
                          style={{ backgroundColor: lane.color }}
                        >
                          {lane.personName.charAt(0)}
                        </span>
                        <span className="text-xs font-medium text-foreground truncate max-w-[120px]">
                          {lane.personName}
                        </span>
                        <span className="text-[11px] text-muted-foreground tabular-nums bg-border/60 rounded px-1.5 py-0.5 shrink-0">
                          {lane.tasks.length} 个任务
                        </span>
                      </button>
                    </td>
                  ) : (
                    <>
                      <td className="sticky left-0 border-b border-r border-border px-4 py-3 align-top bg-inherit z-10">
                        <div className="flex items-center gap-1.5 pt-0.5">
                          <button
                            type="button"
                            onClick={() => toggleLane(lane.personId)}
                            className="shrink-0 p-0.5 -ml-1 rounded hover:bg-accent transition-colors cursor-pointer"
                            aria-label={`折叠 ${lane.personName}`}
                          >
                            <ChevronDown className="w-3.5 h-3.5 text-muted-foreground/60" />
                          </button>
                          <span
                            className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0"
                            style={{ backgroundColor: lane.color }}
                          >
                            {lane.personName.charAt(0)}
                          </span>
                          <span className="text-xs font-medium text-foreground truncate max-w-[72px]">
                            {lane.personName}
                          </span>
                        </div>
                      </td>

                      {sortedColumns.map((col) => {
                        const cellTasks = lane.tasks.filter(t => t.columnId === col.id)
                        const isDone = isCompletedColumn(col)
                        return (
                          <td
                            key={col.id}
                            className={cn(
                              'border-b border-r border-border px-3 py-3 align-top',
                              isDone && 'bg-emerald-50/40',
                            )}
                          >
                            {cellTasks.length > 0 ? (
                              <div className="space-y-1.5">
                                {cellTasks.map(task => (
                                  <TaskPill
                                    key={task.id}
                                    task={task}
                                    isCompleted={isDone}
                                    onClick={() => handleTaskClick(task, lane.color)}
                                  />
                                ))}
                              </div>
                            ) : (
                              <span className="text-[11px] text-muted-foreground/25">—</span>
                            )}
                          </td>
                        )
                      })}
                    </>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* ── Task detail popover ── */}
      {popover && (
        <>
          <div className="fixed inset-0 z-40" onClick={handlePopoverClose} />
          <div className="fixed z-50 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card border border-border rounded-xl shadow-xl p-5 w-80">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div className="min-w-0">
                <h4 className="text-sm font-semibold text-foreground">{popover.task.title}</h4>
                <span className="text-xs text-muted-foreground mt-0.5 block">
                  {sortedColumns.find(c => c.id === popover.task.columnId)?.name ?? '无列'}
                </span>
              </div>
              <button
                onClick={handlePopoverClose}
                className="shrink-0 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                aria-label="关闭"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <dl className="space-y-2 text-xs mb-4">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">优先级</dt>
                <dd className="font-medium" style={{ color: PRIORITY_COLOR[popover.task.priority] }}>
                  {PRIORITY_LABEL[popover.task.priority]}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">负责人</dt>
                <dd className="font-medium text-foreground">
                  {popover.task.assignees.length > 0
                    ? popover.task.assignees.map(u => u.name).join(', ')
                    : '未分配'}
                </dd>
              </div>
              {popover.task.columnEnteredAt && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">停留天数</dt>
                  <dd className="font-medium" style={{ color: popover.color }}>
                    {daysBetween(new Date(popover.task.columnEnteredAt), new Date())} 天
                  </dd>
                </div>
              )}
              {popover.task.estimatedDays != null && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">预估工天</dt>
                  <dd className="font-medium text-foreground">{popover.task.estimatedDays} 天</dd>
                </div>
              )}
            </dl>

            {/* Blocker editor */}
            <div className="border-t border-border pt-3">
              <label className="text-xs font-medium text-muted-foreground block mb-2">卡点说明</label>
              <input
                autoFocus
                value={blockerValue}
                onChange={e => setBlockerValue(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') handleBlockerSave()
                  if (e.key === 'Escape') handlePopoverClose()
                }}
                placeholder="输入卡点说明..."
                className="w-full px-2.5 py-1.5 text-xs border border-border rounded-lg bg-background outline-none focus-visible:outline-none focus:border-primary/30 focus:ring-2 focus:ring-primary/20 transition-colors"
              />
              <div className="flex justify-end gap-2 mt-2.5">
                <button
                  onClick={handlePopoverClose}
                  className="h-7 px-3 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                >
                  取消
                </button>
                <button
                  onClick={handleBlockerSave}
                  className="h-7 px-3 text-xs font-medium bg-primary text-primary-foreground rounded-lg hover:opacity-90 cursor-pointer"
                >
                  保存
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
