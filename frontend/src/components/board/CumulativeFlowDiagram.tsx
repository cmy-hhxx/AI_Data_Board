import { useEffect, useRef, useState } from 'react'
import * as echarts from 'echarts'
import type { EChartsOption } from 'echarts'
import { api } from '../../lib/api'
import type { CumulativeFlowResponse } from '@ai-data-board/shared'

interface Props {
  highlightPersonId?: string
}

const SEMANTIC_COLUMN_COLORS: Record<string, string> = {
  待分配: '#9aa6b8',
  进行中: '#d8b570',
  紧急通道: '#cd7f7f',
  已完成: '#78bca5',
}

const FALLBACK_COLUMN_COLORS = ['#8a97ab', '#7fb3c8', '#a495bf', '#88bdb5']

const TIME_OPTIONS = [
  { label: '7天', value: 7 },
  { label: '30天', value: 30 },
  { label: '90天', value: 90 },
  { label: '180天', value: 180 },
]

function getColumnColor(column: string, index: number) {
  return SEMANTIC_COLUMN_COLORS[column] ?? FALLBACK_COLUMN_COLORS[index % FALLBACK_COLUMN_COLORS.length]
}

export function CumulativeFlowDiagram({ highlightPersonId }: Props) {
  const chartRef = useRef<HTMLDivElement>(null)
  const chartInstance = useRef<echarts.ECharts | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<CumulativeFlowResponse>({ columns: [], series: [] })
  const [days, setDays] = useState(7)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    api.timeline.getCumulativeFlow(days, highlightPersonId)
      .then((res) => {
        if (!cancelled) setData(res)
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Unknown error')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [days, highlightPersonId])

  // Chart init and update
  useEffect(() => {
    if (!chartRef.current || data.columns.length === 0) {
      if (chartInstance.current) {
        chartInstance.current.dispose()
        chartInstance.current = null
      }
      return
    }

    if (!chartInstance.current) {
      chartInstance.current = echarts.init(chartRef.current)
    }

    // Build date-indexed series data
    const dateMap = new Map<string, Map<string, number>>()
    for (const point of data.series) {
      if (!dateMap.has(point.date)) {
        dateMap.set(point.date, new Map())
      }
      dateMap.get(point.date)!.set(point.columnName, point.count)
    }

    const dates = Array.from(dateMap.keys()).sort()
    const seriesColors = data.columns.map((col, idx) => getColumnColor(col, idx))

    const option: EChartsOption = {
      color: seriesColors,
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(255,255,255,0.97)',
        borderColor: '#e2e8f0',
        borderWidth: 1,
        padding: [10, 14],
        textStyle: { fontSize: 12, color: '#1e293b' },
        formatter: (params: unknown) => {
          const items = params as Array<{ seriesName: string; value: number; color: string; axisValue: string }>
          if (!items || items.length === 0) return ''
          const total = items.reduce((sum, item) => sum + item.value, 0)
          const lines = [...items]
            .reverse()
            .filter(item => item.value > 0)
            .map(item => {
              const dot = `<span style="display:inline-block;width:10px;height:10px;border-radius:3px;background:${item.color};margin-right:7px;vertical-align:middle;flex-shrink:0"></span>`
              return `<div style="display:flex;justify-content:space-between;align-items:center;gap:24px;margin:3px 0">`
                + `<span style="display:flex;align-items:center;color:#475569">${dot}${item.seriesName}</span>`
                + `<strong style="color:#0f172a">${item.value}</strong></div>`
            })
          return [
            `<div style="font-weight:700;font-size:13px;margin-bottom:8px;padding-bottom:7px;border-bottom:1px solid #e2e8f0;color:#0f172a">${items[0]?.axisValue}</div>`,
            ...lines,
            `<div style="margin-top:8px;padding-top:7px;border-top:1px solid #e2e8f0;display:flex;justify-content:space-between;align-items:center"><span style="color:#64748b;font-size:11px">总计</span><strong style="color:#0f172a;font-size:13px">${total}</strong></div>`,
          ].join('')
        },
      },
      legend: {
        data: data.columns,
        bottom: 0,
        textStyle: { fontSize: 12, color: '#475569', fontWeight: 500 },
        itemWidth: 14,
        itemHeight: 10,
        itemGap: 18,
        icon: 'roundRect',
        selectedMode: true,
      },
      grid: {
        left: 48,
        right: 20,
        top: 16,
        bottom: 52,
      },
      xAxis: {
        type: 'category',
        data: dates,
        boundaryGap: false,
        axisLabel: {
          fontSize: 11,
          color: '#94a3b8',
          margin: 10,
          formatter: (value: string) => {
            const d = new Date(value)
            return `${d.getMonth() + 1}/${d.getDate()}`
          },
        },
        axisLine: { lineStyle: { color: '#e2e8f0', width: 1 } },
        axisTick: { show: false },
        splitLine: { show: false },
      },
      yAxis: {
        type: 'value',
        minInterval: 1,
        name: '任务数',
        nameTextStyle: { color: '#64748b', fontSize: 11, padding: [0, 0, 0, 8] },
        axisLabel: { fontSize: 11, color: '#94a3b8', margin: 12 },
        splitLine: { lineStyle: { color: '#f1f5f9', type: 'solid', width: 1 } },
        axisLine: { show: false },
        axisTick: { show: false },
      },
      series: data.columns.map((col, idx) => {
        const color = seriesColors[idx]
        return {
          name: col,
          type: 'line',
          stack: 'total',
          smooth: 0.15,
          symbol: 'none',
          areaStyle: {
            color,
            opacity: 0.55,
          },
          lineStyle: {
            color,
            width: 1.6,
            opacity: 1,
          },
          emphasis: {
            focus: 'series',
            areaStyle: { opacity: 0.72 },
            lineStyle: { width: 2 },
          },
          data: dates.map(date => dateMap.get(date)?.get(col) ?? 0),
        }
      }),
    }

    chartInstance.current.setOption(option, true)
  }, [data])

  // Resize observer
  useEffect(() => {
    const el = chartRef.current
    if (!el) return
    const observer = new ResizeObserver(() => { chartInstance.current?.resize() })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // Dispose on unmount
  useEffect(() => {
    return () => {
      chartInstance.current?.dispose()
      chartInstance.current = null
    }
  }, [])

  return (
    <div className="w-full border border-border/40 rounded-xl bg-card p-4 h-full min-h-[320px] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 shrink-0">
        <h3 className="text-xs font-semibold text-muted-foreground/70 uppercase tracking-wider">
          累积流图
        </h3>
        <div className="flex items-center gap-0.5">
          {TIME_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setDays(opt.value)}
              className={`h-6 px-2.5 text-xs rounded-md transition-colors cursor-pointer ${days === opt.value
                ? 'bg-primary/10 text-primary font-medium'
                : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Chart area */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-muted-foreground/20 border-t-muted-foreground rounded-full animate-spin" />
        </div>
      ) : error ? (
        <div className="flex-1 flex items-center justify-center" role="alert" aria-live="polite">
          <p className="text-sm text-muted-foreground">加载失败: {error}</p>
        </div>
      ) : data.columns.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-xs text-muted-foreground/50">暂无列变更数据</p>
        </div>
      ) : (
        <div ref={chartRef} className="flex-1 min-h-0" />
      )}
    </div>
  )
}

