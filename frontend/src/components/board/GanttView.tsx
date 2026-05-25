import { useMemo, useState, useEffect, useRef } from 'react'
import * as echarts from 'echarts'
import type { EChartsOption } from 'echarts'
import { useBoard } from '../../contexts/BoardContext'
import { api } from '../../lib/api'
import type { Task, User, ProgressNote, Priority } from '@ai-data-board/shared'
import { X, Trash2 } from 'lucide-react'

interface GanttViewProps {
  onTaskUpdate: (taskId: string, data: Record<string, unknown>) => Promise<void>
}

// Curated 8-color palette — all hues sit in the 175-240° cool range
// with matched saturation (~50%) and lightness (~60%), so they read as a
// cohesive family while still being distinguishable across person lanes.
// Tasks inherit their lane color, giving each person a unified visual identity.
const PERSON_COLORS = [
  '#5b8fd9', // sky blue
  '#5ba6a0', // teal
  '#8478cc', // periwinkle
  '#4daacd', // cyan
  '#7888cc', // lavender-blue
  '#5ba87e', // sage
  '#6d9ec4', // steel blue
  '#8898c0', // dusty blue
]
const UNASSIGNED_COLOR = '#94a3b8'

const ROW_H = 36          // px per category row inside the chart's grid
const HANDLE_PX = 7       // hit-test tolerance for left/right edge resize
const Y_AXIS_W = 220      // left gutter reserved for category labels
const GRID_TOP = 32       // space above the plot area (x-axis labels)
const GRID_BOTTOM = 12    // space below the plot area
const MS_PER_DAY = 86400000
const TODAY_GRAPHIC_ID = 'gantt-today-line'
const TODAY_LABEL_GRAPHIC_ID = 'gantt-today-label'

function startOfUTCDay(d: Date): Date {
  const r = new Date(d)
  r.setUTCHours(0, 0, 0, 0)
  return r
}
function parseDate(s: string | null): Date | null {
  if (!s) return null
  const d = new Date(s)
  return isNaN(d.getTime()) ? null : startOfUTCDay(d)
}
function addDays(d: Date, n: number): Date {
  const r = new Date(d)
  r.setUTCDate(r.getUTCDate() + n)
  return r
}
function ymd(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function formatNoteTime(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  const m = d.getMonth() + 1
  const day = d.getDate()
  const h = d.getHours().toString().padStart(2, '0')
  const min = d.getMinutes().toString().padStart(2, '0')
  return `${m}/${day} ${h}:${min}`
}

// Resolve a task to the bar's visual [start, end] regardless of which dates are
// set. In-progress tasks live in middle kanban columns where `endDate` stays
// null until the task hits the done column — we still need to render and edit
// those, so we extend the open side to today.
function computeBarDates(t: Task): { start: Date; end: Date; openStart: boolean; openEnd: boolean } {
  const s = parseDate(t.startDate)
  const e = parseDate(t.endDate)
  const today = startOfUTCDay(new Date())
  if (s && e) return { start: s, end: e, openStart: false, openEnd: false }
  if (s) {
    const end = today > s ? addDays(today, 1) : addDays(s, 1)
    return { start: s, end, openStart: false, openEnd: true }
  }
  if (e) {
    const start = today < e ? addDays(today, -1) : addDays(e, -1)
    return { start, end: e, openStart: true, openEnd: false }
  }
  // No dates at all — anchor a 1-day placeholder on today so the task is still
  // reachable for the progress/note dialog.
  return { start: today, end: addDays(today, 1), openStart: true, openEnd: true }
}

interface Lane {
  personId: string
  personName: string
  color: string
  tasks: Task[]
}

interface DialogState {
  task: Task
  color: string
  notes: ProgressNote[]
  newNoteText: string
  loading: boolean
}

interface Row {
  kind: 'person' | 'task'
  lane: Lane
  task?: Task
}

interface DragState {
  taskId: string
  kind: 'body' | 'left' | 'right'
  initialStart: Date
  initialEnd: Date
  initialTimeMs: number
  moved: boolean
}

interface LivePreview {
  taskId: string
  start: Date
  end: Date
}

export function GanttView({ onTaskUpdate }: GanttViewProps) {
  const { state } = useBoard()
  const [users, setUsers] = useState<User[]>([])
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [dialog, setDialog] = useState<DialogState | null>(null)
  const [livePreview, setLivePreview] = useState<LivePreview | null>(null)

  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<HTMLDivElement>(null)
  const chartInst = useRef<echarts.ECharts | null>(null)
  const dragRef = useRef<DragState | null>(null)
  // Click on a collapsed lane's summary bar → toggle expand. Tracked separately
  // from dragRef so we never confuse a summary click with a task drag.
  const summaryClickRef = useRef<{ laneId: string } | null>(null)
  // onTaskUpdate is recreated by the parent on every render; keep a ref so the
  // init effect can stay on a [] dependency list (chart shouldn't dispose/reinit
  // every time the parent re-renders).
  const onTaskUpdateRef = useRef(onTaskUpdate)
  useEffect(() => { onTaskUpdateRef.current = onTaskUpdate })

  useEffect(() => { api.users.list().then(setUsers) }, [])

  const lanes = useMemo<Lane[]>(() => {
    const byPerson = new Map<string | null, Task[]>()
    for (const t of state.tasks) {
      const arr = byPerson.get(t.assignee) ?? []
      arr.push(t)
      byPerson.set(t.assignee, arr)
    }
    const out: Lane[] = []
    users.forEach((u, i) => {
      const ts = byPerson.get(u.id) ?? []
      if (ts.length === 0) return
      out.push({
        personId: u.id,
        personName: u.name,
        color: PERSON_COLORS[i % PERSON_COLORS.length],
        tasks: ts,
      })
    })
    const unassigned = byPerson.get(null) ?? []
    if (unassigned.length > 0) {
      out.push({
        personId: '__unassigned',
        personName: '未指派',
        color: UNASSIGNED_COLOR,
        tasks: unassigned,
      })
    }
    return out
  }, [users, state.tasks])

  const rows = useMemo<Row[]>(() => {
    const out: Row[] = []
    for (const lane of lanes) {
      out.push({ kind: 'person', lane })
      if (expanded.has(lane.personId)) {
        for (const t of lane.tasks) out.push({ kind: 'task', lane, task: t })
      }
    }
    return out
  }, [lanes, expanded])

  // For each collapsed lane, the [earliest start, latest end] across its tasks.
  // Drives both the summary bar render and the summary-click hit-test.
  const summaryByLane = useMemo(() => {
    const m = new Map<string, { start: Date; end: Date }>()
    for (const lane of lanes) {
      if (expanded.has(lane.personId)) continue
      const ts: number[] = []
      for (const t of lane.tasks) {
        const bd = computeBarDates(t)
        ts.push(bd.start.getTime(), bd.end.getTime())
      }
      if (ts.length === 0) continue
      m.set(lane.personId, {
        start: new Date(Math.min(...ts)),
        end: new Date(Math.max(...ts)),
      })
    }
    return m
  }, [lanes, expanded])

  const range = useMemo(() => {
    // Always include today so the today-marker and open-ended bars are in view.
    const ts: number[] = [startOfUTCDay(new Date()).getTime()]
    for (const t of state.tasks) {
      const bd = computeBarDates(t)
      ts.push(bd.start.getTime(), bd.end.getTime())
    }
    return {
      min: addDays(new Date(Math.min(...ts)), -3).getTime(),
      max: addDays(new Date(Math.max(...ts)), 4).getTime(),
    }
  }, [state.tasks])

  // Latest state for handlers registered once at mount.
  const stateRef = useRef({ rows, livePreview, expanded, summaryByLane })
  useEffect(() => { stateRef.current = { rows, livePreview, expanded, summaryByLane } })

  // ── Init chart once ──
  useEffect(() => {
    if (!chartRef.current) return
    const chart = echarts.init(chartRef.current)
    chartInst.current = chart

    const onResize = () => chart.resize()
    window.addEventListener('resize', onResize)

    // Y-axis label click → toggle expand.
    chart.on('click', (params) => {
      if (params.componentType !== 'yAxis') return
      const idx = (params as { dataIndex?: number }).dataIndex
      if (idx === undefined) return
      const row = stateRef.current.rows[idx]
      if (row?.kind !== 'person') return
      setExpanded(prev => {
        const next = new Set(prev)
        if (next.has(row.lane.personId)) next.delete(row.lane.personId)
        else next.add(row.lane.personId)
        return next
      })
    })

    // Drag interaction via zrender low-level events.
    const zr = chart.getZr()

    zr.on('mousedown', (e) => {
      const px = (e as { offsetX: number }).offsetX
      const py = (e as { offsetY: number }).offsetY
      const pt = chart.convertFromPixel({ xAxisIndex: 0, yAxisIndex: 0 }, [px, py]) as number[] | undefined
      if (!pt) return
      const [timeMs, yCatF] = pt
      const rowIdx = Math.round(yCatF)
      const row = stateRef.current.rows[rowIdx]
      if (!row) return

      // Collapsed person row: hit-test against the summary bar; click toggles expand.
      if (row.kind === 'person') {
        if (stateRef.current.expanded.has(row.lane.personId)) return
        const sum = stateRef.current.summaryByLane.get(row.lane.personId)
        if (!sum) return
        const sPx = chart.convertToPixel({ xAxisIndex: 0, yAxisIndex: 0 }, [sum.start.getTime(), rowIdx]) as number[] | undefined
        const ePx = chart.convertToPixel({ xAxisIndex: 0, yAxisIndex: 0 }, [sum.end.getTime(), rowIdx]) as number[] | undefined
        if (!sPx || !ePx) return
        if (px < sPx[0] || px > ePx[0]) return
        if (Math.abs(py - sPx[1]) > ROW_H * 0.4) return
        summaryClickRef.current = { laneId: row.lane.personId }
        return
      }

      if (row.kind !== 'task' || !row.task) return
      const t = row.task
      const bd = computeBarDates(t)
      const startPx = chart.convertToPixel({ xAxisIndex: 0, yAxisIndex: 0 }, [bd.start.getTime(), rowIdx]) as number[] | undefined
      const endPx = chart.convertToPixel({ xAxisIndex: 0, yAxisIndex: 0 }, [bd.end.getTime(), rowIdx]) as number[] | undefined
      if (!startPx || !endPx) return
      // Click must be within the bar's x range (with handle tolerance) and near its y row center.
      if (px < startPx[0] - HANDLE_PX || px > endPx[0] + HANDLE_PX) return
      if (Math.abs(py - startPx[1]) > ROW_H * 0.4) return
      let kind: DragState['kind'] = 'body'
      if (px <= startPx[0] + HANDLE_PX) kind = 'left'
      else if (px >= endPx[0] - HANDLE_PX) kind = 'right'
      dragRef.current = {
        taskId: t.id,
        kind,
        initialStart: bd.start,
        initialEnd: bd.end,
        initialTimeMs: timeMs,
        moved: false,
      }
      // Cursor hint
      if (chartRef.current) {
        chartRef.current.style.cursor = kind === 'body' ? 'grabbing' : 'ew-resize'
      }
    })

    zr.on('mousemove', (e) => {
      const drag = dragRef.current
      if (!drag) return
      const px = (e as { offsetX: number }).offsetX
      const py = (e as { offsetY: number }).offsetY
      const pt = chart.convertFromPixel({ xAxisIndex: 0, yAxisIndex: 0 }, [px, py]) as number[] | undefined
      if (!pt) return
      const curTimeMs = pt[0]
      const shiftDays = Math.round((curTimeMs - drag.initialTimeMs) / MS_PER_DAY)
      if (shiftDays !== 0) drag.moved = true
      let newStart = drag.initialStart
      let newEnd = drag.initialEnd
      if (drag.kind === 'left') {
        newStart = addDays(drag.initialStart, shiftDays)
        if (newStart >= drag.initialEnd) newStart = addDays(drag.initialEnd, -1)
      } else if (drag.kind === 'right') {
        newEnd = addDays(drag.initialEnd, shiftDays)
        if (newEnd <= drag.initialStart) newEnd = addDays(drag.initialStart, 1)
      } else {
        newStart = addDays(drag.initialStart, shiftDays)
        newEnd = addDays(drag.initialEnd, shiftDays)
      }
      setLivePreview({ taskId: drag.taskId, start: newStart, end: newEnd })
    })

    zr.on('mouseup', () => {
      // 1) Summary-bar click on a collapsed lane → toggle expand.
      const sumClick = summaryClickRef.current
      summaryClickRef.current = null
      if (sumClick) {
        setExpanded(prev => {
          const next = new Set(prev)
          if (next.has(sumClick.laneId)) next.delete(sumClick.laneId)
          else next.add(sumClick.laneId)
          return next
        })
        return
      }

      const drag = dragRef.current
      if (!drag) return
      const preview = stateRef.current.livePreview
      const moved = drag.moved
      dragRef.current = null
      if (chartRef.current) chartRef.current.style.cursor = ''
      const row = stateRef.current.rows.find(r => r.kind === 'task' && r.task?.id === drag.taskId)
      const task = row?.task
      setLivePreview(null)
      if (!task) return
      if (!moved) {
        setDialog({
          task,
          color: row.lane.color,
          notes: [],
          newNoteText: '',
          loading: true,
        })
        return
      }
      if (!preview || preview.taskId !== drag.taskId) return
      const newStart = ymd(preview.start)
      const newEnd = ymd(preview.end)
      // Only commit the side(s) the user actually adjusted. Dragging the left
      // edge of an in-progress (endDate=null) task shouldn't silently
      // concretize the end. Body drag = both sides move together.
      const updates: Record<string, unknown> = {}
      if ((drag.kind === 'left' || drag.kind === 'body') && newStart !== task.startDate) {
        updates.startDate = newStart
      }
      if ((drag.kind === 'right' || drag.kind === 'body') && newEnd !== task.endDate) {
        updates.endDate = newEnd
      }
      if (Object.keys(updates).length === 0) return
      onTaskUpdateRef.current(task.id, updates).catch(() => { })
    })

    return () => {
      window.removeEventListener('resize', onResize)
      chart.dispose()
      chartInst.current = null
    }
  }, [])

  // ── Render option whenever rows / preview / range / expanded changes ──
  useEffect(() => {
    const chart = chartInst.current
    if (!chart) return

    // Lock the chart's plot area to exactly rows.length × ROW_H. Echarts
    // category axis distributes its bands across the plot height, so if the
    // plot were any other size the band size (and the Y of every row) would
    // depend on the row count. Padding with min height would silently
    // re-center the first row when, e.g., only "未指派" is collapsed.
    const desiredHeight = GRID_TOP + Math.max(1, rows.length) * ROW_H + GRID_BOTTOM
    if (chartRef.current) {
      chartRef.current.style.height = `${desiredHeight}px`
    }
    chart.resize()

    const yAxisData = rows.map(row => {
      if (row.kind === 'person') {
        const caret = expanded.has(row.lane.personId) ? '{ca|▾}' : '{ca|▸}'
        return `${caret} ${row.lane.personName} (${row.lane.tasks.length})`
      }
      // Task rows: uniform neutral dot — priority is already encoded in the bar color.
      return `  {dot|·} ${row.task!.title}`
    })

    type DataItem = {
      value: [number, number, number]  // startMs, endMs, yIdx
      itemStyle: { color: string }
    }
    const seriesData: DataItem[] = []
    const colorByIndex: string[] = []
    const kindByIndex: Array<'summary' | 'task'> = []
    const openStartByIndex: boolean[] = []
    const openEndByIndex: boolean[] = []
    rows.forEach((row, idx) => {
      if (row.kind === 'person') {
        // Render a summary bar when the lane is collapsed.
        if (expanded.has(row.lane.personId)) return
        const sum = summaryByLane.get(row.lane.personId)
        if (!sum) return
        colorByIndex.push(row.lane.color)
        kindByIndex.push('summary')
        openStartByIndex.push(false)
        openEndByIndex.push(false)
        seriesData.push({
          value: [sum.start.getTime(), sum.end.getTime(), idx],
          itemStyle: { color: row.lane.color },
        })
        return
      }
      if (!row.task) return
      const live = livePreview?.taskId === row.task.id ? livePreview : null
      const bd = computeBarDates(row.task)
      const s = live?.start ?? bd.start
      const ed = live?.end ?? bd.end
      // During live drag the user is explicitly sizing the bar, so don't
      // render dashed "open" edges in that frame.
      colorByIndex.push(row.lane.color)
      kindByIndex.push('task')
      openStartByIndex.push(!live && bd.openStart)
      openEndByIndex.push(!live && bd.openEnd)
      seriesData.push({
        value: [s.getTime(), ed.getTime(), idx],
        itemStyle: { color: row.lane.color },
      })
    })

    const todayMs = startOfUTCDay(new Date()).getTime()

    const option: EChartsOption = {
      animation: false,
      grid: {
        top: GRID_TOP,
        left: Y_AXIS_W,
        right: 24,
        bottom: GRID_BOTTOM,
        containLabel: false,
      },
      xAxis: {
        type: 'time',
        position: 'top',
        min: range.min,
        max: range.max,
        axisLine: { lineStyle: { color: '#d1d5db' } },
        axisTick: { lineStyle: { color: '#d1d5db' } },
        axisLabel: {
          color: '#6b7280',
          fontSize: 10,
          hideOverlap: true,
        },
        splitLine: { show: true, lineStyle: { color: '#e5e7eb', opacity: 0.6 } },
      },
      yAxis: {
        type: 'category',
        data: yAxisData,
        inverse: true,
        triggerEvent: true,
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: {
          color: '#374151',
          fontSize: 11,
          align: 'left',
          margin: Y_AXIS_W - 12,
          formatter: (v: string) => v,
          rich: {
            ca: { color: '#b0b8c4', fontSize: 9 },
            dot: { color: '#c8d0d8', fontSize: 13 },
          },
        },
        splitLine: { show: true, lineStyle: { color: '#e5e7eb', opacity: 0.4 } },
      },
      series: [{
        type: 'custom',
        encode: { x: [0, 1], y: 2 },
        data: seriesData,
        renderItem: (params, apiInst) => {
          const startTs = apiInst.value(0) as number
          const endTs = apiInst.value(1) as number
          const yIdx = apiInst.value(2) as number
          const startPt = apiInst.coord([startTs, yIdx]) as number[]
          const endPt = apiInst.coord([endTs, yIdx]) as number[]
          const rowSize = apiInst.size!([0, 1]) as number[]
          const rowH = rowSize[1]
          const barH = Math.max(14, rowH * 0.55)
          const y = startPt[1] - barH / 2
          const x = startPt[0]
          const w = Math.max(2, endPt[0] - x)
          const idx = params.dataIndex
          const color = colorByIndex[idx] ?? '#888888'
          const kind = kindByIndex[idx]

          if (kind === 'summary') {
            // Collapsed lane summary bar — flat fill, pill shape.
            const sH = Math.max(12, barH * 0.62)
            const sY = y + (barH - sH) / 2
            return {
              type: 'rect',
              shape: { x, y: sY, width: w, height: sH, r: sH / 2 },
              style: {
                fill: color + '60',
                stroke: color + '99',
                lineWidth: 1,
              },
              cursor: 'pointer',
            }
          }

          // Task bar with visible drag handles on each end.
          const isOpen = (openStartByIndex[idx] ?? false) || (openEndByIndex[idx] ?? false)
          const handleW = w > 18 ? 5 : 0
          const showHandles = handleW > 0
          return {
            type: 'group',
            children: [
              {
                type: 'rect',
                shape: { x, y, width: w, height: barH, r: 4 },
                style: {
                  fill: color + '50',
                  stroke: color + 'C0',
                  lineWidth: 1,
                  lineDash: isOpen ? [4, 3] : undefined,
                },
                cursor: 'grab',
              },
              ...(showHandles ? [
                {
                  type: 'rect' as const,
                  shape: { x: x + 0.5, y: y + 1, width: handleW, height: barH - 2, r: 2 },
                  style: { fill: color + 'CC' },
                  cursor: 'ew-resize',
                },
                {
                  type: 'rect' as const,
                  shape: { x: x + w - handleW - 0.5, y: y + 1, width: handleW, height: barH - 2, r: 2 },
                  style: { fill: color + 'CC' },
                  cursor: 'ew-resize',
                },
              ] : []),
            ],
          }
        },
        z: 2,
      }],
    }

    chart.setOption(option, true)

    const todayPixel = chart.convertToPixel({ xAxisIndex: 0 }, todayMs) as number | undefined
    if (typeof todayPixel !== 'number' || !Number.isFinite(todayPixel)) {
      chart.setOption({
        graphic: [
          { id: TODAY_GRAPHIC_ID, $action: 'remove' },
          { id: TODAY_LABEL_GRAPHIC_ID, $action: 'remove' },
        ],
      })
      return
    }

    const gridHeight = Math.max(0, chart.getHeight() - GRID_TOP - GRID_BOTTOM)

    chart.setOption({
      graphic: [
        {
          id: TODAY_GRAPHIC_ID,
          type: 'line',
          silent: true,
          shape: {
            x1: todayPixel,
            y1: GRID_TOP,
            x2: todayPixel,
            y2: GRID_TOP + gridHeight,
          },
          style: {
            stroke: '#f87171',
            lineWidth: 1,
            lineDash: [5, 4],
          },
          z: 10,
        },
        {
          id: TODAY_LABEL_GRAPHIC_ID,
          type: 'text',
          silent: true,
          x: todayPixel + 4,
          y: GRID_TOP - 16,
          style: {
            text: '今天',
            fill: '#f87171',
            font: '10px sans-serif',
          },
          z: 10,
        },
      ],
    })
  }, [rows, expanded, livePreview, range, summaryByLane])

  // Load notes when the dialog opens for a different task.
  useEffect(() => {
    if (!dialog || !dialog.loading) return
    const projectId = state.currentProjectId
    const taskId = dialog.task.id
    if (!projectId) {
      setDialog(prev => (prev && prev.task.id === taskId) ? { ...prev, loading: false } : prev)
      return
    }
    let cancelled = false
    api.progressNotes.list(projectId, taskId)
      .then(notes => {
        if (cancelled) return
        setDialog(prev => (prev && prev.task.id === taskId) ? { ...prev, notes, loading: false } : prev)
      })
      .catch(() => {
        if (cancelled) return
        setDialog(prev => (prev && prev.task.id === taskId) ? { ...prev, loading: false } : prev)
      })
    return () => { cancelled = true }
  }, [dialog?.task.id, dialog?.loading, state.currentProjectId])

  const addNote = async () => {
    if (!dialog) return
    const content = dialog.newNoteText.trim()
    if (!content) return
    const projectId = state.currentProjectId
    if (!projectId) return
    const taskId = dialog.task.id
    try {
      const note = await api.progressNotes.create(projectId, taskId, { content })
      setDialog(prev => (prev && prev.task.id === taskId)
        ? { ...prev, notes: [note, ...prev.notes], newNoteText: '' }
        : prev)
    } catch { /* silent */ }
  }

  const deleteNote = async (noteId: string) => {
    if (!dialog) return
    const projectId = state.currentProjectId
    if (!projectId) return
    const taskId = dialog.task.id
    try {
      await api.progressNotes.delete(projectId, taskId, noteId)
      setDialog(prev => (prev && prev.task.id === taskId)
        ? { ...prev, notes: prev.notes.filter(n => n.id !== noteId) }
        : prev)
    } catch { /* silent */ }
  }

  // Always mount the chart container — even before users load — so the init
  // effect can attach to a real DOM node on first render. The empty-state
  // overlay sits on top when there's no data to show.
  return (
    <div className="px-6 pt-2 pb-6" style={{ height: 'calc(100vh - 44px)' }}>
      <div
        ref={containerRef}
        className="border border-border rounded-xl bg-card w-full h-full overflow-auto relative"
      >
        <div
          ref={chartRef}
          className="w-full"
          style={{ height: GRID_TOP + Math.max(1, rows.length) * ROW_H + GRID_BOTTOM, minWidth: 800 }}
        />
        {lanes.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground/60 pointer-events-none">
            暂无任务可显示
          </div>
        )}
      </div>

      {dialog && (
        <>
          {/* Backdrop — click anywhere outside the panel to dismiss. */}
          <div
            className="fixed inset-0 z-40 bg-black/20"
            onClick={() => setDialog(null)}
          />
          {/* Slide-over panel (anchored to right) */}
          <aside className="fixed top-0 right-0 bottom-0 z-50 w-[480px] max-w-[90vw] bg-card border-l border-border shadow-2xl flex flex-col">
            <header className="flex items-center justify-between px-5 py-3.5 border-b border-border shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: dialog.color }} />
                <span className="text-sm font-semibold truncate">{dialog.task.title}</span>
              </div>
              <button onClick={() => setDialog(null)} className="p-1 hover:bg-accent rounded">
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </header>

            {/* History (fills remaining height, scrolls independently) */}
            <div className="flex-1 overflow-y-auto px-5 py-4">
              <label className="text-xs text-muted-foreground block mb-2.5">进度记录</label>
              {dialog.loading ? (
                <div className="text-xs text-muted-foreground/60 py-8 text-center">加载中…</div>
              ) : dialog.notes.length === 0 ? (
                <div className="text-xs text-muted-foreground/60 py-8 text-center">暂无记录</div>
              ) : (
                <div className="space-y-2">
                  {dialog.notes.map(n => (
                    <div
                      key={n.id}
                      className="group rounded-md border border-border/60 bg-muted/30 px-3 py-2"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] text-muted-foreground tabular-nums">
                          {formatNoteTime(n.createdAt)}
                        </span>
                        <button
                          onClick={() => deleteNote(n.id)}
                          className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-accent-foreground/10 transition-opacity"
                          aria-label="删除记录"
                        >
                          <Trash2 className="w-3 h-3 text-muted-foreground/60 hover:text-destructive" />
                        </button>
                      </div>
                      <p className="text-xs whitespace-pre-wrap break-words leading-relaxed">{n.content}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Compose (always anchored to bottom) */}
            <footer className="border-t border-border px-5 py-3.5 space-y-2 shrink-0">
              <label className="text-xs text-muted-foreground block">添加进度记录</label>
              <textarea
                value={dialog.newNoteText}
                onChange={(e) => setDialog({ ...dialog, newNoteText: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault()
                    addNote()
                  }
                }}
                rows={3}
                placeholder="例如：本次完成 30%，接口已联调"
                className="w-full text-xs border border-border rounded-md px-2 py-1.5 bg-background outline-none resize-none focus:border-foreground/40"
              />
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-muted-foreground/60">⌘/Ctrl + Enter 快捷添加</span>
                <button
                  onClick={addNote}
                  disabled={!dialog.newNoteText.trim()}
                  className="h-7 px-3 text-xs font-medium bg-foreground text-background rounded disabled:opacity-40"
                >
                  添加
                </button>
              </div>
            </footer>
          </aside>
        </>
      )}
    </div>
  )
}
