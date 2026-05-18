import { useMemo, useState, useEffect, useCallback } from 'react'
import { useBoard } from '../../contexts/BoardContext'
import { api } from '../../lib/api'
import type { Task, Priority, BoardColumn, User } from '@ai-data-board/shared'

interface ProgressViewProps {
  onTaskUpdate: (taskId: string, data: Record<string, unknown>) => Promise<void>
}

function isCompletedColumn(col: BoardColumn): boolean {
  const name = col.name.toLowerCase()
  return name.includes('完成') || name.includes('done') || name.includes('completed')
}

function parseDate(v: string | null): Date | null {
  if (!v) return null
  const d = new Date(v)
  return isNaN(d.getTime()) ? null : d
}

const priorityColors: Record<Priority, string> = {
  urgent: '#c6908a',
  high: '#c9a87c',
  medium: '#8a9eb5',
  low: '#b0b8c0',
}

const priorityLabels: Record<Priority, string> = {
  urgent: '紧急',
  high: '高',
  medium: '中',
  low: '低',
}

export function ProgressView({ onTaskUpdate }: ProgressViewProps) {
  const { state } = useBoard()
  const [users, setUsers] = useState<User[]>([])
  const [editingBlocker, setEditingBlocker] = useState<string | null>(null)
  const [blockerValue, setBlockerValue] = useState('')

  useEffect(() => {
    api.users.list().then(setUsers).catch(console.error)
  }, [])

  const currentProject = state.projects.find((p) => p.id === state.currentProjectId) ?? null

  const projectTasks = useMemo(
    () => state.tasks.filter((t) => t.projectId === state.currentProjectId),
    [state.tasks, state.currentProjectId],
  )

  const sortedColumns = useMemo(
    () => [...state.columns].sort((a, b) => a.position - b.position),
    [state.columns],
  )

  const completedColIds = useMemo(
    () => new Set(sortedColumns.filter(isCompletedColumn).map((c) => c.id)),
    [sortedColumns],
  )

  // --- Computed stats ---
  const completedCount = projectTasks.filter((t) => t.columnId && completedColIds.has(t.columnId)).length
  const totalCount = projectTasks.length
  const completionRate = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0

  const columnDistribution = useMemo(() => {
    return sortedColumns.map((col) => ({
      column: col,
      count: projectTasks.filter((t) => t.columnId === col.id).length,
    }))
  }, [sortedColumns, projectTasks])

  const maxColumnCount = Math.max(1, ...columnDistribution.map((d) => d.count))

  const urgentCount = projectTasks.filter((t) => t.priority === 'urgent').length
  const blockedCount = projectTasks.filter((t) => t.blocker && t.blocker.trim() !== '').length

  const today = useMemo(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
  }, [])

  const overdueCount = projectTasks.filter((t) => {
    if (!t.endDate) return false
    if (t.columnId && completedColIds.has(t.columnId)) return false
    const end = parseDate(t.endDate)
    return end && end < today
  }).length

  const getColumnName = useCallback(
    (columnId: string | null) => {
      if (!columnId) return '-'
      return sortedColumns.find((c) => c.id === columnId)?.name ?? '-'
    },
    [sortedColumns],
  )

  // --- Handlers ---
  const handleBlockerStartEdit = useCallback((taskId: string, currentBlocker: string | null) => {
    setEditingBlocker(taskId)
    setBlockerValue(currentBlocker ?? '')
  }, [])

  const handleBlockerSave = useCallback(
    async (taskId: string) => {
      const trimmed = blockerValue.trim()
      await onTaskUpdate(taskId, { blocker: trimmed || null })
      setEditingBlocker(null)
    },
    [blockerValue, onTaskUpdate],
  )

  const handleBlockerCancel = useCallback(() => {
    setEditingBlocker(null)
  }, [])

  const handleAssigneeChange = useCallback(
    async (taskId: string, assigneeId: string) => {
      await onTaskUpdate(taskId, { assignee: assigneeId || null })
    },
    [onTaskUpdate],
  )

  const handleColumnMove = useCallback(
    async (taskId: string, columnId: string) => {
      await onTaskUpdate(taskId, { columnId })
    },
    [onTaskUpdate],
  )

  if (!currentProject) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
        请先选择一个项目
      </div>
    )
  }

  return (
    <div className="px-6 pt-3 pb-6 overflow-y-auto" style={{ height: 'calc(100vh - 44px)' }}>
      <div className="space-y-4 max-w-5xl">
        {/* 1. Summary Bar */}
        <div className="bg-card border border-border/60 rounded-xl p-4 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold">{currentProject.name}</h2>
            <p className="text-xs text-muted-foreground mt-0.5">项目推进面板</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-2xl font-bold tabular-nums">{completionRate}%</p>
              <p className="text-xs text-muted-foreground">
                {completedCount}/{totalCount} 任务已完成
              </p>
            </div>
            <svg width="48" height="48" viewBox="0 0 48 48" className="shrink-0">
              <circle cx="24" cy="24" r="20" fill="none" stroke="currentColor" strokeWidth="4" className="text-muted/20" />
              <circle
                cx="24" cy="24" r="20" fill="none" stroke="currentColor" strokeWidth="4"
                strokeLinecap="round"
                className="text-emerald-500"
                strokeDasharray={`${(completionRate / 100) * 125.66} 125.66`}
                transform="rotate(-90 24 24)"
              />
            </svg>
          </div>
        </div>

        {/* 2. Column Distribution + 3. Risk Area */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Column Distribution */}
          <div className="bg-card border border-border/60 rounded-xl p-4">
            <h3 className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wider">
              流程分布
            </h3>
            {columnDistribution.length === 0 ? (
              <p className="text-xs text-muted-foreground/60">暂无列数据</p>
            ) : (
              <div className="space-y-2">
                {columnDistribution.map(({ column, count }) => {
                  const completed = isCompletedColumn(column)
                  const pct = maxColumnCount > 0 ? (count / maxColumnCount) * 100 : 0
                  return (
                    <div key={column.id} className="flex items-center gap-2">
                      <span
                        className={`text-xs w-20 shrink-0 truncate ${completed ? 'text-emerald-600 font-medium' : 'text-muted-foreground'}`}
                      >
                        {column.name}
                      </span>
                      <div className="flex-1 h-5 bg-muted/50 rounded overflow-hidden">
                        <div
                          className={`h-full rounded transition-all ${completed ? 'bg-emerald-500' : 'bg-neutral-400'}`}
                          style={{ width: `${Math.max(pct, count > 0 ? 3 : 0)}%` }}
                        />
                      </div>
                      <span
                        className={`text-xs tabular-nums w-6 text-right ${completed ? 'text-emerald-600 font-semibold' : 'text-muted-foreground'}`}
                      >
                        {count}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Risk Area */}
          <div className="bg-card border border-border/60 rounded-xl p-4">
            <h3 className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wider">
              风险概览
            </h3>
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-red-600 tabular-nums">{urgentCount}</p>
                <p className="text-xs text-red-500 mt-1">紧急任务</p>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-amber-600 tabular-nums">{blockedCount}</p>
                <p className="text-xs text-amber-500 mt-1">有卡点</p>
              </div>
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-orange-600 tabular-nums">{overdueCount}</p>
                <p className="text-xs text-orange-500 mt-1">已逾期</p>
              </div>
            </div>
            <div className="mt-4 p-3 bg-muted/30 rounded-lg">
              <p className="text-xs text-muted-foreground leading-relaxed">
                {urgentCount === 0 && blockedCount === 0 && overdueCount === 0
                  ? '项目推进正常，无风险项。'
                  : [
                      urgentCount > 0 && `${urgentCount} 个紧急任务需优先处理`,
                      blockedCount > 0 && `${blockedCount} 个任务存在卡点`,
                      overdueCount > 0 && `${overdueCount} 个任务已逾期`,
                    ]
                      .filter(Boolean)
                      .join('；') + '。'}
              </p>
            </div>
          </div>
        </div>

        {/* 4. Task Push List */}
        <div className="bg-card border border-border/60 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-border/40 flex items-center justify-between">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              任务推进列表
            </h3>
            <span className="text-xs text-muted-foreground">{totalCount} 个任务</span>
          </div>

          {totalCount === 0 ? (
            <div className="px-4 py-12 text-center text-sm text-muted-foreground/60">
              当前项目暂无任务
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border/40 bg-muted/20">
                    <th className="text-left px-3 py-2.5 font-medium text-muted-foreground w-[28%]">任务</th>
                    <th className="text-left px-3 py-2.5 font-medium text-muted-foreground w-[13%]">负责人</th>
                    <th className="text-center px-2 py-2.5 font-medium text-muted-foreground w-[6%]">优先级</th>
                    <th className="text-left px-3 py-2.5 font-medium text-muted-foreground w-[10%]">所在列</th>
                    <th className="text-left px-3 py-2.5 font-medium text-muted-foreground w-[14%]">起止日期</th>
                    <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">卡点</th>
                    <th className="text-center px-3 py-2.5 font-medium text-muted-foreground w-[10%]">推进</th>
                  </tr>
                </thead>
                <tbody>
                  {projectTasks
                    .slice()
                    .sort((a, b) => a.position - b.position)
                    .map((task) => {
                      const isOverdue = (() => {
                        if (!task.endDate) return false
                        if (task.columnId && completedColIds.has(task.columnId)) return false
                        const end = parseDate(task.endDate)
                        return end && end < today
                      })()

                      return (
                        <tr
                          key={task.id}
                          className={`border-b border-border/20 hover:bg-muted/10 transition-colors ${isOverdue ? 'bg-orange-50/30' : ''}`}
                        >
                          {/* Title */}
                          <td className="px-3 py-2.5 min-w-0">
                            <span className="block truncate font-medium" title={task.title}>{task.title}</span>
                          </td>

                          {/* Assignee */}
                          <td className="px-3 py-2.5 min-w-0">
                            <select
                              value={task.assignee ?? ''}
                              onChange={(e) => handleAssigneeChange(task.id, e.target.value)}
                              className="w-full max-w-[120px] text-xs border border-border/40 rounded px-1.5 py-1 bg-transparent hover:border-border focus:outline-none focus:border-foreground/30 truncate"
                              title={task.assignee ? (users.find(u => u.id === task.assignee)?.name ?? task.assignee) : '未分配'}
                            >
                              <option value="">未分配</option>
                              {users.map((u) => (
                                <option key={u.id} value={u.id}>
                                  {u.name}
                                </option>
                              ))}
                            </select>
                          </td>

                          {/* Priority */}
                          <td className="px-2 py-2.5 text-center">
                            <span
                              className="inline-block w-2.5 h-2.5 rounded-full"
                              style={{ backgroundColor: priorityColors[task.priority] }}
                              title={priorityLabels[task.priority]}
                            />
                          </td>

                          {/* Column */}
                          <td className="px-3 py-2.5">
                            <span
                              className={
                                task.columnId && completedColIds.has(task.columnId) ? 'text-emerald-600 font-medium' : ''
                              }
                            >
                              {getColumnName(task.columnId)}
                            </span>
                          </td>

                          {/* Dates */}
                          <td className="px-3 py-2.5">
                            <span
                              className={`tabular-nums whitespace-nowrap ${isOverdue ? 'text-red-500' : 'text-muted-foreground'}`}
                            >
                              {task.startDate ? task.startDate.slice(0, 10) : '?'} ~{' '}
                              {task.endDate ? task.endDate.slice(0, 10) : '?'}
                            </span>
                          </td>

                          {/* Blocker */}
                          <td className="px-3 py-2.5 min-w-0">
                            {editingBlocker === task.id ? (
                              <div className="flex items-center gap-1">
                                <input
                                  autoFocus
                                  value={blockerValue}
                                  onChange={(e) => setBlockerValue(e.target.value)}
                                  onBlur={() => handleBlockerSave(task.id)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleBlockerSave(task.id)
                                    if (e.key === 'Escape') handleBlockerCancel()
                                  }}
                                  placeholder="输入卡点..."
                                  className="w-full min-w-[80px] text-xs border border-border/40 rounded px-1.5 py-0.5 bg-background outline-none focus:border-foreground/30"
                                  title="编辑卡点说明"
                                />
                              </div>
                            ) : (
                              <button
                                onClick={() => handleBlockerStartEdit(task.id, task.blocker)}
                                title={task.blocker || '点击添加卡点说明'}
                                className={`text-left w-full min-w-[80px] px-1.5 py-0.5 rounded hover:bg-muted/50 transition-colors truncate ${
                                  task.blocker ? 'text-amber-600 font-medium' : 'text-muted-foreground/40 italic'
                                }`}
                              >
                                {task.blocker || '无卡点'}
                              </button>
                            )}
                          </td>

                          {/* Push Action: Move to column */}
                          <td className="px-3 py-2.5 text-center min-w-0">
                            <select
                              value={task.columnId ?? ''}
                              onChange={(e) => {
                                if (e.target.value && e.target.value !== (task.columnId ?? '')) {
                                  handleColumnMove(task.id, e.target.value)
                                }
                              }}
                              className="w-full max-w-[100px] text-xs border border-border/40 rounded px-1.5 py-1 bg-transparent hover:border-border focus:outline-none focus:border-foreground/30 truncate"
                              title="推进任务到其他列"
                            >
                              <option value="" disabled>
                                移动到...
                              </option>
                              {sortedColumns.map((col) => (
                                <option key={col.id} value={col.id}>
                                  {col.name}
                                </option>
                              ))}
                            </select>
                          </td>
                        </tr>
                      )
                    })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
