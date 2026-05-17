import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useBoard } from '../../contexts/BoardContext'
import { api } from '../../lib/api'
import type { Task, Priority } from '@ai-data-board/shared'
import { CalendarDays, Check, Flag, GripHorizontal, Pencil, Trash2, User, X } from 'lucide-react'
import { cn } from '../../lib/utils'

type DatedTask = Task & { start: Date; end: Date }
type DragMode = 'move' | 'start' | 'end'

interface ProgressEntry {
  id: string
  taskId: string
  date: string
  text: string
}

interface DragState {
  taskId: string
  mode: DragMode
  originX: number
  originalStart: Date
  originalEnd: Date
  previewStart: Date
  previewEnd: Date
  hasMoved: boolean
}

const dayWidth = 104
const progressStorageKey = 'ai-data-board:progress-entries'

function parseDate(value: string | null) {
  if (!value) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split('-').map(Number)
    return new Date(year, month - 1, day)
  }
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return null
  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate())
}

function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function addDays(date: Date, days: number) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

function diffDays(start: Date, end: Date) {
  return Math.round((end.getTime() - start.getTime()) / 86400000)
}

function minDate(a: Date, b: Date) {
  return a <= b ? a : b
}

function maxDate(a: Date, b: Date) {
  return a >= b ? a : b
}

function newId() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function loadProgressEntries(): ProgressEntry[] {
  try {
    return JSON.parse(localStorage.getItem(progressStorageKey) || '[]') as ProgressEntry[]
  } catch {
    return []
  }
}

const priorityMeta: Record<Priority, { label: string; color: string; tint: string }> = {
  urgent: { label: '紧急', color: '#ef4444', tint: 'bg-red-50 text-red-600' },
  high: { label: '高', color: '#f97316', tint: 'bg-orange-50 text-orange-600' },
  medium: { label: '中', color: '#2563eb', tint: 'bg-blue-50 text-blue-600' },
  low: { label: '低', color: '#94a3b8', tint: 'bg-slate-100 text-slate-500' },
}

export function ProgressView() {
  const { state, dispatch } = useBoard()
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [entries, setEntries] = useState<ProgressEntry[]>(() => loadProgressEntries())
  const [entryText, setEntryText] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingText, setEditingText] = useState('')
  const [drag, setDrag] = useState<DragState | null>(null)
  const suppressBarClickRef = useRef(false)

  useEffect(() => {
    localStorage.setItem(progressStorageKey, JSON.stringify(entries))
  }, [entries])

  const { dayCount, days, rows, today } = useMemo(() => {
    const now = new Date()
    const today = dateKey(now)
    const dated: DatedTask[] = []

    for (const task of state.tasks) {
      const end = parseDate(task.endDate)
      if (!end) continue
      const start = parseDate(task.startDate) ?? parseDate(task.createdAt) ?? end
      dated.push({ ...task, start: minDate(start, end), end: maxDate(start, end) })
    }

    if (dated.length === 0) {
      const from = addDays(new Date(now.getFullYear(), now.getMonth(), now.getDate()), -2)
      const days = Array.from({ length: 14 }, (_, index) => dateKey(addDays(from, index)))
      return { dayCount: days.length, days, rows: [] as DatedTask[], today }
    }

    const min = dated.reduce((acc, task) => minDate(acc, task.start), dated[0].start)
    const max = dated.reduce((acc, task) => maxDate(acc, task.end), dated[0].end)
    const from = addDays(min, -2)
    const to = addDays(max, 4)
    const days: string[] = []
    for (let day = new Date(from); day <= to; day = addDays(day, 1)) {
      days.push(dateKey(day))
    }

    return {
      dayCount: days.length,
      days,
      rows: dated.sort((a, b) => a.end.getTime() - b.end.getTime()),
      today,
    }
  }, [state.tasks])

  const selectedTask = rows.find(task => task.id === selectedTaskId) ?? null
  const selectedEntries = entries
    .filter(entry => entry.taskId === selectedTaskId)
    .sort((a, b) => b.date.localeCompare(a.date))

  const persistTaskDates = useCallback(async (taskId: string, start: Date, end: Date) => {
    if (!state.currentProjectId) return
    const payload = { startDate: dateKey(start), endDate: dateKey(end) }
    dispatch({ type: 'UPDATE_TASK', payload: { ...state.tasks.find(task => task.id === taskId)!, ...payload } })
    try {
      const updated = await api.tasks.update(state.currentProjectId, taskId, payload)
      dispatch({ type: 'UPDATE_TASK', payload: updated })
    } catch (error) {
      console.error(error)
    }
  }, [dispatch, state.currentProjectId, state.tasks])

  useEffect(() => {
    if (!drag) return

    const handleMouseMove = (event: MouseEvent) => {
      const delta = Math.round((event.clientX - drag.originX) / dayWidth)
      let previewStart = drag.originalStart
      let previewEnd = drag.originalEnd

      if (drag.mode === 'move') {
        previewStart = addDays(drag.originalStart, delta)
        previewEnd = addDays(drag.originalEnd, delta)
      } else if (drag.mode === 'start') {
        previewStart = minDate(addDays(drag.originalStart, delta), drag.originalEnd)
      } else {
        previewEnd = maxDate(addDays(drag.originalEnd, delta), drag.originalStart)
      }

      if (delta !== 0) {
        suppressBarClickRef.current = true
      }
      setDrag({ ...drag, previewStart, previewEnd, hasMoved: drag.hasMoved || delta !== 0 })
    }

    const handleMouseUp = () => {
      setDrag(current => {
        if (current?.hasMoved) {
          persistTaskDates(current.taskId, current.previewStart, current.previewEnd)
        }
        return null
      })
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp, { once: true })
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [drag, persistTaskDates])

  const startDrag = (event: React.MouseEvent, task: DatedTask, mode: DragMode) => {
    event.preventDefault()
    event.stopPropagation()
    suppressBarClickRef.current = false
    setDrag({
      taskId: task.id,
      mode,
      originX: event.clientX,
      originalStart: task.start,
      originalEnd: task.end,
      previewStart: task.start,
      previewEnd: task.end,
      hasMoved: false,
    })
  }

  const addEntry = () => {
    if (!selectedTaskId || !entryText.trim()) return
    setEntries(prev => [
      { id: newId(), taskId: selectedTaskId, date: dateKey(new Date()), text: entryText.trim() },
      ...prev,
    ])
    setEntryText('')
  }

  const openTaskProgress = (event: React.MouseEvent, taskId: string) => {
    event.stopPropagation()
    if (suppressBarClickRef.current) {
      suppressBarClickRef.current = false
      return
    }
    setSelectedTaskId(taskId)
  }

  const saveEntry = (id: string) => {
    if (!editingText.trim()) return
    setEntries(prev => prev.map(entry => entry.id === id ? { ...entry, text: editingText.trim() } : entry))
    setEditingId(null)
    setEditingText('')
  }

  const removeEntry = (id: string) => {
    setEntries(prev => prev.filter(entry => entry.id !== id))
  }

  return (
    <div className="px-6 pt-2 pb-6" style={{ height: 'calc(100vh - 72px)' }}>
      <div className="bg-card border border-border/60 rounded-xl shadow-sm overflow-hidden h-full flex">
        <section className="min-w-0 flex-1 flex flex-col">
          <div className="flex items-center justify-between px-4 h-11 border-b border-border/40 shrink-0">
            <div className="flex items-baseline gap-2">
              <span className="text-sm font-semibold">进度总览</span>
              <span className="text-[11px] text-muted-foreground">
                {state.projects.find(project => project.id === state.currentProjectId)?.name ?? '当前项目'}
              </span>
            </div>
            <span className="text-[11px] text-muted-foreground/70">拖动时间条移动周期，拖两端调整起止</span>
          </div>

          <div className="flex-1 overflow-auto">
            {rows.length === 0 ? (
              <div className="flex items-center justify-center h-full text-sm text-muted-foreground/60">
                为任务设置截止时间后，甘特图会自动出现。
              </div>
            ) : (
              <div
                className="grid min-w-full"
                style={{ gridTemplateColumns: `260px repeat(${dayCount}, ${dayWidth}px)` }}
              >
                <div className="sticky top-0 z-10 col-span-full grid bg-card" style={{ gridTemplateColumns: `260px repeat(${dayCount}, ${dayWidth}px)` }}>
                  <div className="h-9 px-3 flex items-center text-[11px] font-semibold text-muted-foreground border-b border-r border-border/40">
                    任务
                  </div>
                  {days.map(day => {
                    const isToday = day === today
                    return (
                      <div
                        key={day}
                        className={cn(
                          'h-9 flex items-center justify-center text-[11px] border-b border-l border-border/40',
                          isToday && 'bg-foreground text-background font-semibold'
                        )}
                      >
                        {isToday ? '今天' : day.slice(5)}
                      </div>
                    )
                  })}
                </div>

                {rows.map(task => {
                  const activeDrag = drag?.taskId === task.id ? drag : null
                  const start = activeDrag?.previewStart ?? task.start
                  const end = activeDrag?.previewEnd ?? task.end
                  const barStart = diffDays(parseDate(days[0]) ?? start, start)
                  const barSpan = Math.max(diffDays(start, end), 0) + 1
                  const taskEntries = entries.filter(entry => entry.taskId === task.id).length

                  return (
                    <div key={task.id} className="contents">
                      <div
                        className={cn(
                          'h-[46px] px-3 border-b border-r border-border/40 flex items-center transition-colors',
                          selectedTaskId === task.id && 'bg-muted/50'
                        )}
                      >
                        <div className="min-w-0">
                          <p className="text-xs font-medium truncate">{task.title}</p>
                          <p className="flex items-center gap-2 text-[11px] text-muted-foreground">
                            <span className="inline-flex items-center gap-1"><User className="w-3 h-3" />{task.assignee || '未指派'}</span>
                            <span className="inline-flex items-center gap-1"><CalendarDays className="w-3 h-3" />{dateKey(start).slice(5)} ~ {dateKey(end).slice(5)}</span>
                          </p>
                        </div>
                      </div>

                      <div
                        className="relative h-[46px] border-b border-border/40"
                        style={{ gridColumn: `span ${dayCount}` }}
                      >
                        <div className="absolute inset-0 flex">
                          {days.map(day => (
                            <div key={day} className="h-full border-l border-border/30" style={{ width: dayWidth }} />
                          ))}
                        </div>
                        <div
                          className="absolute top-1/2 -translate-y-1/2 h-5 rounded-md shadow-sm cursor-grab active:cursor-grabbing group"
                          style={{
                            left: `${barStart * dayWidth + 8}px`,
                            width: `${Math.max(barSpan * dayWidth - 16, 28)}px`,
                            backgroundColor: priorityMeta[task.priority].color,
                          }}
                          onClick={(event) => openTaskProgress(event, task.id)}
                          onMouseDown={(event) => startDrag(event, task, 'move')}
                          title="拖动调整时间"
                        >
                          <button
                            className="absolute left-0 top-0 h-full w-3 cursor-ew-resize rounded-l-md bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity"
                            onMouseDown={(event) => startDrag(event, task, 'start')}
                            onClick={(event) => event.stopPropagation()}
                            aria-label="调整开始时间"
                          />
                          <button
                            className="absolute right-0 top-0 h-full w-3 cursor-ew-resize rounded-r-md bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity"
                            onMouseDown={(event) => startDrag(event, task, 'end')}
                            onClick={(event) => event.stopPropagation()}
                            aria-label="调整截止时间"
                          />
                          <GripHorizontal className="absolute left-1/2 top-1/2 w-3 h-3 -translate-x-1/2 -translate-y-1/2 text-white/70 opacity-0 group-hover:opacity-100 transition-opacity" />
                          {taskEntries > 0 && (
                            <span className="absolute -right-1.5 -top-1.5 h-4 min-w-4 px-1 rounded-full bg-foreground text-background text-[10px] leading-4 text-center">
                              {taskEntries}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </section>

        {selectedTask && (
          <aside className="w-80 border-l border-border/50 bg-muted/20 flex flex-col">
            <div className="px-4 py-3 border-b border-border/40">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold leading-snug">{selectedTask.title}</p>
                  <div className="flex flex-wrap items-center gap-1.5 mt-2 text-[11px]">
                    <span className="inline-flex items-center gap-1 h-5 px-1.5 rounded-md bg-card text-muted-foreground">
                      <User className="w-3 h-3" />{selectedTask.assignee || '未指派'}
                    </span>
                    <span className={cn('inline-flex items-center gap-1 h-5 px-1.5 rounded-md', priorityMeta[selectedTask.priority].tint)}>
                      <Flag className="w-3 h-3" />{priorityMeta[selectedTask.priority].label}
                    </span>
                  </div>
                </div>
                <button onClick={() => setSelectedTaskId(null)} className="p-1 rounded-md hover:bg-accent transition-colors" aria-label="关闭进展">
                  <X className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>
            </div>

            <div className="p-4 border-b border-border/40">
              <div className="relative">
                <textarea
                  value={entryText}
                  onChange={(event) => setEntryText(event.target.value)}
                  onKeyDown={(event) => {
                    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
                      addEntry()
                    }
                  }}
                  placeholder="记录进展，例如：完成数据口径确认"
                  className="w-full min-h-20 resize-none px-2.5 py-2 text-xs bg-card border border-border/60 rounded-lg outline-none focus:border-foreground/25"
                />
              </div>
              <p className="mt-1.5 text-[10px] text-muted-foreground/50">自动记录为今天，按 Cmd/Ctrl + Enter 保存。</p>
            </div>

            <div className="flex-1 overflow-auto p-4 space-y-2">
              {selectedEntries.length === 0 ? (
                <p className="text-xs text-muted-foreground/60 leading-5">还没有进展记录。点击时间条后，这里才显示任务过程。</p>
              ) : selectedEntries.map(entry => (
                <div key={entry.id} className="bg-card border border-border/60 rounded-xl p-3">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-[11px] text-muted-foreground">{entry.date}</span>
                    <div className="flex items-center gap-1">
                      {editingId === entry.id ? (
                        <button onClick={() => saveEntry(entry.id)} className="p-1 rounded-md hover:bg-accent transition-colors" aria-label="保存进展">
                          <Check className="w-3.5 h-3.5" />
                        </button>
                      ) : (
                        <button onClick={() => { setEditingId(entry.id); setEditingText(entry.text) }} className="p-1 rounded-md hover:bg-accent transition-colors" aria-label="编辑进展">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button onClick={() => removeEntry(entry.id)} className="p-1 rounded-md hover:bg-accent transition-colors" aria-label="删除进展">
                        <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />
                      </button>
                    </div>
                  </div>
                  {editingId === entry.id ? (
                    <textarea
                      value={editingText}
                      onChange={(event) => setEditingText(event.target.value)}
                      className="w-full min-h-16 resize-none px-2 py-1.5 text-xs bg-background border border-border/60 rounded-lg outline-none"
                    />
                  ) : (
                    <p className="text-xs leading-5 text-foreground/85 whitespace-pre-wrap">{entry.text}</p>
                  )}
                </div>
              ))}
            </div>
          </aside>
        )}
      </div>
    </div>
  )
}
