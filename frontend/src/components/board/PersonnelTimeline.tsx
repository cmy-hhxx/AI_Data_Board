import { useEffect, useState, useRef, useMemo } from 'react'
import * as echarts from 'echarts'
import type { EChartsOption, CustomSeriesOption } from 'echarts'
import { api } from '../../lib/api'

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

interface PersonNode {
  id: string
  name: string
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
  chartData: ChartDataItem[]
} {
  const personNames = people.map((p) => p.name)
  const chartData: ChartDataItem[] = []

  for (const person of people) {
    for (const project of person.projects) {
      for (const task of project.tasks) {
        if (task.startDate && task.endDate) {
          chartData.push({
            value: [person.name, task.startDate, task.endDate],
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

  return { personNames, chartData }
}

export function PersonnelTimeline() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [people, setPeople] = useState<PersonNode[]>([])

  const chartRef = useRef<HTMLDivElement>(null)
  const chartInstance = useRef<echarts.ECharts | null>(null)

  useEffect(() => {
    api
      .timeline
      .get()
      .then((data) => {
        if (data && data.people) {
          setPeople(data.people.filter((p) => p.projects.length > 0))
        }
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Unknown error'))
      .finally(() => setLoading(false))
  }, [])

  const { personNames, chartData } = useMemo(
    () => buildChartData(people),
    [people]
  )

  const taskToDataIndex = useMemo(() => {
    const map = new Map<string, number>()
    chartData.forEach((item, index) => {
      map.set(item.taskId, index)
    })
    return map
  }, [chartData])

  // Chart initialization and data update
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
          const d = (params as { data: ChartDataItem }).data
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
        left: 10,
        right: 30,
        top: 10,
        bottom: 48,
        containLabel: true,
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
          const p = params as { dataIndex: number; data: ChartDataItem }
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
          const color = priorityColors[p.data.priority] || '#94a3b8'
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
      <div className="w-full flex items-center justify-center py-16">
        <div className="w-6 h-6 border-2 border-muted-foreground/20 border-t-muted-foreground rounded-full animate-spin" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="w-full flex items-center justify-center py-16">
        <p className="text-sm text-muted-foreground">加载失败: {error}</p>
      </div>
    )
  }

  if (people.length === 0) {
    return (
      <div className="w-full flex items-center justify-center py-16">
        <p className="text-sm text-muted-foreground/60">暂无人员时间线数据</p>
      </div>
    )
  }

  const chartHeight = Math.max(personNames.length * 34 + 96, 280)

  return (
    <div
      className="flex border border-border/40 rounded-xl overflow-hidden bg-card"
      style={{ minHeight: 400 }}
    >
      {/* Left tree area */}
      <div className="w-[300px] shrink-0 border-r border-border/40 overflow-y-auto p-4 max-h-[600px]">
        <h3 className="text-xs font-semibold text-muted-foreground/70 uppercase tracking-wider mb-3">
          人员工作总览
        </h3>

        {people.map((person) => (
          <details key={person.id} className="mb-0.5" onToggle={() => { chartInstance.current?.resize() }}>
            <summary className="cursor-pointer text-sm font-medium text-foreground py-1.5 pl-2 pr-2 rounded hover:bg-accent/50 transition-colors flex items-center gap-1.5 marker:content-none [&::-webkit-details-marker]:hidden">
              <span className="text-[9px] text-muted-foreground/40 shrink-0">
                ▶
              </span>
              <span className="truncate">{person.name}</span>
              <span className="text-[10px] text-muted-foreground/50 shrink-0">
                ({person.projects.reduce((sum, p) => sum + p.tasks.length, 0)})
              </span>
            </summary>

            <div className="ml-2 border-l border-border/30 pl-2">
              {person.projects.map((project) => (
                <details key={project.id} className="mb-0.5" onToggle={() => { chartInstance.current?.resize() }}>
                  <summary
                    className="cursor-pointer text-xs text-foreground/80 py-1 pl-1.5 pr-1.5 rounded hover:bg-accent/30 transition-colors flex items-center gap-1 marker:content-none [&::-webkit-details-marker]:hidden border-l-[3px] border-transparent"
                    style={project.color ? { borderLeftColor: project.color + '40' } : undefined}
                  >
                    <span className="text-[8px] text-muted-foreground/40 shrink-0">
                      ▶
                    </span>
                    {project.color && (
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: project.color }}
                      />
                    )}
                    <span className="truncate">{project.name}</span>
                    <span className="text-[10px] text-muted-foreground/50 shrink-0">
                      ({project.tasks.length})
                    </span>
                  </summary>

                  <div className="ml-2 border-l border-border/20 pl-1.5">
                    {project.tasks.map((task) => (
                      <button
                        key={task.id}
                        type="button"
                        onMouseEnter={() => {
                          const idx = taskToDataIndex.get(task.id)
                          if (idx !== undefined && chartInstance.current) {
                            chartInstance.current.dispatchAction({
                              type: 'highlight',
                              seriesIndex: 0,
                              dataIndex: idx,
                            })
                            chartInstance.current.dispatchAction({
                              type: 'showTip',
                              seriesIndex: 0,
                              dataIndex: idx,
                            })
                          }
                        }}
                        onMouseLeave={() => {
                          chartInstance.current?.dispatchAction({
                            type: 'downplay',
                            seriesIndex: 0,
                          })
                        }}
                        onClick={() => {
                          const idx = taskToDataIndex.get(task.id)
                          if (idx !== undefined && chartInstance.current) {
                            chartInstance.current.dispatchAction({
                              type: 'highlight',
                              seriesIndex: 0,
                              dataIndex: idx,
                            })
                            chartInstance.current.dispatchAction({
                              type: 'showTip',
                              seriesIndex: 0,
                              dataIndex: idx,
                            })
                            setTimeout(() => {
                              chartInstance.current?.dispatchAction({
                                type: 'downplay',
                                seriesIndex: 0,
                              })
                            }, 3000)
                          }
                        }}
                        className="block w-full text-left text-[11px] leading-tight text-muted-foreground hover:text-foreground py-0.5 px-1.5 rounded hover:bg-accent/30 transition-colors duration-150 truncate"
                      >
                        {task.title}
                      </button>
                    ))}
                  </div>
                </details>
              ))}
            </div>
          </details>
        ))}
      </div>

      {/* Right chart area */}
      <div className="flex-1 min-w-0 p-4 bg-muted/20">
        <h3 className="text-xs font-semibold text-muted-foreground/70 uppercase tracking-wider mb-3">
          时间线
        </h3>

        {chartData.length === 0 ? (
          <div className="flex items-center justify-center" style={{ height: chartHeight }}>
            <p className="text-xs text-muted-foreground/50">暂无包含日期的任务</p>
          </div>
        ) : (
          <div ref={chartRef} className="w-full" style={{ height: chartHeight }} />
        )}
      </div>
    </div>
  )
}
