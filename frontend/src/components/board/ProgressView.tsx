import { useMemo, useState, useEffect, useCallback } from 'react'
import { useBoard } from '../../contexts/BoardContext'
import { api } from '../../lib/api'
import type { Task, BoardColumn, User } from '@ai-data-board/shared'
import { X, AlertCircle } from 'lucide-react'
import { cn } from '../../lib/utils'

interface ProgressViewProps {
  onTaskUpdate: (taskId: string, data: Record<string, unknown>) => Promise<void>
}

const PERSON_COLORS = [
  '#4C72B0', '#DD8452', '#55A868', '#C44E52', '#8172B3',
  '#937860', '#DA8BC3', '#8C8C8C', '#CCB974', '#64B5CD',
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

export function ProgressView({ onTaskUpdate }: ProgressViewProps) {
  const { state } = useBoard()
  const [users, setUsers] = useState<User[]>([])
  const [popover, setPopover] = useState<{ task: Task; color: string } | null>(null)
  const [blockerValue, setBlockerValue] = useState('')

  useEffect(() => {
    api.users.list().then(setUsers).catch(console.error)
  }, [])

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
    const grouped = new Map<string, { tasks: Task[]; color: string }>()
    for (const task of projectTasks) {
      const key = task.assignee || '__unassigned__'
      if (!grouped.has(key)) {
        const colorIdx = grouped.size
        grouped.set(key, {
          tasks: [],
          color: key === '__unassigned__' ? '#9CA3AF' : PERSON_COLORS[colorIdx % PERSON_COLORS.length],
        })
      }
      grouped.get(key)!.tasks.push(task)
    }
    return [...grouped.entries()]
      .map(([id, data]) => ({
        personId: id,
        personName: users.find(u => u.id === id)?.name ?? '待认领',
        tasks: data.tasks.sort((a, b) => a.position - b.position),
        color: data.color,
      }))
      .sort((a, b) => {
        if (a.personId === '__unassigned__') return 1
        if (b.personId === '__unassigned__') return -1
        return b.tasks.length - a.tasks.length
      })
  }, [projectTasks, users])

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

        <div className="flex items-center gap-3 flex-1 max-w-xs">
          <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${completionPct}%`,
                backgroundColor: completionPct === 100 ? '#10B981' : 'hsl(var(--primary))',
              }}
            />
          </div>
          <span className="text-xs text-muted-foreground shrink-0 tabular-nums">
            {completedCount}/{totalCount} 完成
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
            {lanes.map((lane, laneIdx) => (
              <tr key={lane.personId} className={laneIdx % 2 === 0 ? 'bg-background' : 'bg-muted/10'}>
                {/* Person label cell */}
                <td className="sticky left-0 border-b border-r border-border px-4 py-3 align-top bg-inherit z-10">
                  <div className="flex items-center gap-2 pt-0.5">
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

                {/* Column task cells */}
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
              </tr>
            ))}
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
                  {users.find(u => u.id === popover.task.assignee)?.name ?? '未分配'}
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
              {popover.task.estimatedHours != null && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">预估工天</dt>
                  <dd className="font-medium text-foreground">{popover.task.estimatedHours} 天</dd>
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
                className="w-full px-2.5 py-1.5 text-xs border border-border rounded-lg bg-background outline-none focus:border-primary/30 transition-colors"
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
