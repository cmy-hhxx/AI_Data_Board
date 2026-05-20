import { useEffect, useRef, useMemo } from 'react'
import * as echarts from 'echarts'
import type { EChartsOption, CustomSeriesOption } from 'echarts'

type Priority = 'low' | 'medium' | 'high' | 'urgent'

interface TimelineTask {
  id: string
  title: string
  priority: Priority
  columnName: string
  startDate: string | null
  endDate: string | null
}

interface PersonProjectNode {
  id: string
  name: string
  color: string | null
  tasks: TimelineTask[]
}

export interface PersonNode {
  id: string
  name: string
  role: string
  projects: PersonProjectNode[]
}

const priorityColors: Record<Priority, string> = {
  urgent: '#c6908a',
  high: '#c9a87c',
  medium: '#8a9eb5',
  low: '#b0b8c0',
}

interface ChartDataItem {
  value: [string, string, string]
  personId: string
  taskId: string
  taskTitle: string
  projectName: string
  assigneeName: string
  priority: Priority
  columnName: string
  start: string
  end: string
}

function buildChartData(people: PersonNode[]): {
  personNames: string[]
  personIds: string[]
  chartData: ChartDataItem[]
} {
  const personNames: string[] = []
  const personIds: string[] = []
  const chartData: ChartDataItem[] = []

  for (const person of people) {
    personNames.push(person.name)
    personIds.push(person.id)
    for (const project of person.projects) {
      for (const task of project.tasks) {
        if (task.startDate && task.endDate) {
          chartData.push({
            value: [person.name, task.startDate, task.endDate],
            personId: person.id,
            taskId: task.id,
            taskTitle: task.title,
            projectName: project.name,
            assigneeName: person.name,
            priority: task.priority,
            columnName: task.columnName,
            start: task.startDate,
            end: task.endDate,
          })
        }
      }
    }
  }

  return { personNames, personIds, chartData }
}

interface Props {
  people: PersonNode[]
  highlightPersonId?: string
  onPersonSelect?: (id: string) => void
  loading?: boolean
  error?: string | null
}

export function PersonnelTimeline({ people, highlightPersonId, onPersonSelect, loading, error }: Props) {
  const chartRef = useRef<HTMLDivElement>(null)
  const chartInstance = useRef<echarts.ECharts | null>(null)

  const { personNames, personIds, chartData } = useMemo(
    () => buildChartData(people),
    [people]
  )

  // Chart init and update
  useEffect(() => {
    if (!chartRef.current || chartData.length === 0) {
      if (chartInstance.current) {
        chartInstance.current.dispose()
        chartInstance.current = null
      }
      return
    }

    if (!chartInstance.current) {
      chartInstance.current = echarts.init(chartRef.current)
    }

    const option: EChartsOption = {
      tooltip: {
        trigger: 'item',
        formatter: (params: unknown) => {
          const d = (params as { data?: ChartDataItem })?.data
          if (!d) return ''
          const formattedStart = new Date(d.start).toLocaleDateString('zh-CN')
          const formattedEnd = new Date(d.end).toLocaleDateString('zh-CN')
          return [
            `<strong>${d.taskTitle}</strong>`,
            `项目: ${d.projectName}`,
            `负责人: ${d.assigneeName}`,
            `优先级: ${d.priority}`,
            `所在列: ${d.columnName}`,
            `开始: ${formattedStart}`,
            `结束: ${formattedEnd}`,
          ].join('<br/>')
        },
      },
      dataZoom: [
        {
          type: 'slider',
          bottom: 10,
          height: 18,
          brushSelect: false,
        },
      ],
      grid: {
        left: 100,
        right: 30,
        top: 10,
        bottom: 48,
        containLabel: false,
      },
      xAxis: {
        type: 'time',
        axisLabel: {
          fontSize: 11,
          color: '#94a3b8',
        },
        splitLine: {
          lineStyle: { color: '#f8fafc' },
        },
      },
      yAxis: {
        type: 'category',
        data: personNames,
        axisLabel: {
          fontSize: 12,
          color: '#64748b',
        },
        axisLine: { show: false },
        axisTick: { show: false },
      },
      series: [{
        type: 'custom',
        renderItem: (params: unknown, api: unknown) => {
          const p = params as { dataIndex: number }
          const a = api as {
            value: (idx: number) => string
            coord: (point: [string, string]) => [number, number]
            size: (point: [number, number]) => [number, number]
          }

          const yValue = a.value(0)
          const startVal = a.value(1)
          const endVal = a.value(2)
          const [x1, y] = a.coord([startVal, yValue])
          const [x2] = a.coord([endVal, yValue])

          const barHeight = Math.min(a.size([0, 1])[1] * 0.55, 22)
          const d = chartData[p.dataIndex]
          const color = d ? priorityColors[d.priority] : '#94a3b8'
          const width = Math.max(x2 - x1, 2)

          return {
            type: 'rect',
            shape: {
              x: x1,
              y: y - barHeight / 2,
              width,
              height: barHeight,
              r: 3,
            },
            style: {
              fill: color,
            },
          }
        },
        encode: {
          y: 0,
          x: [1, 2],
        },
        data: chartData,
      }] as CustomSeriesOption[],
    }

    chartInstance.current.setOption(option, true)
  }, [chartData, personNames])

  // Chart click → emit person select
  useEffect(() => {
    const chart = chartInstance.current
    if (!chart) return

    const handler = (params: unknown) => {
      const d = (params as { data?: ChartDataItem })?.data
      if (d?.personId) {
        onPersonSelect?.(d.personId)
      }
    }

    chart.on('click', handler)
    return () => {
      chart.off('click', handler)
    }
  }, [onPersonSelect])

  // Highlight person
  useEffect(() => {
    const chart = chartInstance.current
    if (!chart) return

    chart.dispatchAction({ type: 'downplay', seriesIndex: 0 })

    if (highlightPersonId) {
      chartData.forEach((item, idx) => {
        if (item.personId === highlightPersonId) {
          chart.dispatchAction({ type: 'highlight', seriesIndex: 0, dataIndex: idx })
        }
      })
    }
  }, [highlightPersonId, chartData])

  // Resize observer
  useEffect(() => {
    const el = chartRef.current
    if (!el) return

    const observer = new ResizeObserver(() => {
      chartInstance.current?.resize()
    })
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-6 h-6 border-2 border-muted-foreground/20 border-t-muted-foreground rounded-full animate-spin" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-16">
        <p className="text-sm text-muted-foreground">加载失败: {error}</p>
      </div>
    )
  }

  if (people.length === 0 || chartData.length === 0) {
    return (
      <div className="flex items-center justify-center py-16">
        <p className="text-xs text-muted-foreground/50">暂无包含日期的任务</p>
      </div>
    )
  }

  const chartHeight = Math.max(personNames.length * 34 + 96, 280)

  return (
    <div className="w-full border border-border/40 rounded-xl bg-card p-4">
      <h3 className="text-xs font-semibold text-muted-foreground/70 uppercase tracking-wider mb-3">
        人员时间线
      </h3>
      <div ref={chartRef} className="w-full" style={{ height: chartHeight }} />
    </div>
  )
}
