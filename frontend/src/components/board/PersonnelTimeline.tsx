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

interface TimelinePerson {
  id: string
  name: string
  tasks: TimelineTask[]
}

interface ProjectNode {
  id: string
  name: string
  color: string | null
  people: TimelinePerson[]
}

const priorityColors: Record<Priority, string> = {
  urgent: '#ef4444',
  high: '#fb923c',
  medium: '#3b82f6',
  low: '#d1d5db',
}

interface ChartDataItem {
  value: [string, string, string]
  taskTitle: string
  projectName: string
  priority: Priority
  start: string
  end: string
}

function buildProjectTree(
  people: Array<{
    id: string
    name: string
    projects: Array<{
      id: string
      name: string
      color: string | null
      tasks: TimelineTask[]
    }>
  }>
): ProjectNode[] {
  const projectMap = new Map<string, ProjectNode>()

  for (const person of people) {
    for (const project of person.projects) {
      if (!projectMap.has(project.id)) {
        projectMap.set(project.id, {
          id: project.id,
          name: project.name,
          color: project.color,
          people: [],
        })
      }
      const proj = projectMap.get(project.id)!
      let personNode = proj.people.find((p) => p.id === person.id)
      if (!personNode) {
        personNode = { id: person.id, name: person.name, tasks: [] }
        proj.people.push(personNode)
      }
      personNode.tasks.push(...project.tasks)
    }
  }

  return Array.from(projectMap.values())
}

function buildChartData(projectNodes: ProjectNode[]): {
  personNames: string[]
  chartData: ChartDataItem[]
} {
  const personOrder: string[] = []
  const seen = new Set<string>()

  for (const proj of projectNodes) {
    for (const person of proj.people) {
      if (!seen.has(person.id)) {
        seen.add(person.id)
        personOrder.push(person.name)
      }
    }
  }

  const personIndex = new Map(personOrder.map((name, i) => [name, i]))

  const chartData: ChartDataItem[] = []

  for (const proj of projectNodes) {
    for (const person of proj.people) {
      for (const task of person.tasks) {
        if (task.startDate && task.endDate) {
          chartData.push({
            value: [person.name, task.startDate, task.endDate],
            taskTitle: task.title,
            projectName: proj.name,
            priority: task.priority,
            start: task.startDate,
            end: task.endDate,
          })
        }
      }
    }
  }

  return { personNames: personOrder, chartData }
}

export function PersonnelTimeline() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [projectNodes, setProjectNodes] = useState<ProjectNode[]>([])

  const chartRef = useRef<HTMLDivElement>(null)
  const chartInstance = useRef<echarts.ECharts | null>(null)

  useEffect(() => {
    api
      .timeline
      .get()
      .then((data) => {
        if (data && data.people) {
          setProjectNodes(buildProjectTree(data.people))
        }
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Unknown error'))
      .finally(() => setLoading(false))
  }, [])

  const { personNames, chartData } = useMemo(
    () => buildChartData(projectNodes),
    [projectNodes]
  )

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
            `优先级: ${d.priority}`,
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
          lineStyle: { color: '#f1f5f9' },
        },
      },
      yAxis: {
        type: 'category',
        data: personNames,
        axisLabel: {
          fontSize: 11,
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
              r: 2,
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

  if (projectNodes.length === 0) {
    return (
      <div className="w-full flex items-center justify-center py-16">
        <p className="text-sm text-muted-foreground/60">暂无人员时间线数据</p>
      </div>
    )
  }

  const chartHeight = Math.max(personNames.length * 40 + 100, 300)

  return (
    <div
      className="flex border border-border/60 rounded-xl overflow-hidden bg-card"
      style={{ minHeight: 400 }}
    >
      {/* Left tree area */}
      <div className="w-[300px] shrink-0 border-r border-border/60 overflow-y-auto p-4 max-h-[600px]">
        <h3 className="text-xs font-semibold text-muted-foreground/70 uppercase tracking-wider mb-3">
          项目人员
        </h3>

        {projectNodes.map((project) => (
          <details key={project.id} className="mb-0.5">
            <summary className="cursor-pointer text-sm font-medium text-foreground py-1.5 pl-2 pr-2 rounded hover:bg-accent/50 transition-colors flex items-center gap-1.5 marker:content-none [&::-webkit-details-marker]:hidden border-l-[3px] border-transparent"
              style={project.color ? { borderLeftColor: project.color + '40' } : undefined}
            >
              <span className="text-[9px] text-muted-foreground/40 shrink-0">
                ▶
              </span>
              <span className="truncate">{project.name}</span>
            </summary>

            <div className="ml-3 border-l border-border/30 pl-3">
              {project.people.map((person) => (
                <details key={person.id} className="mb-0.5">
                  <summary className="cursor-pointer text-xs text-foreground/80 py-1 pl-1.5 pr-1.5 rounded hover:bg-accent/30 transition-colors flex items-center gap-1 marker:content-none [&::-webkit-details-marker]:hidden">
                    <span className="text-[8px] text-muted-foreground/40 shrink-0">
                      ▶
                    </span>
                    <span className="truncate">{person.name}</span>
                    <span className="text-[10px] text-muted-foreground/50 shrink-0">
                      ({person.tasks.length})
                    </span>
                  </summary>

                  <div className="ml-3 border-l border-border/20 pl-2">
                    {person.tasks.map((task) => (
                      <button
                        key={task.id}
                        type="button"
                        onClick={() =>
                          console.log('Task clicked:', task.id, task.title)
                        }
                        className="block w-full text-left text-[11px] text-muted-foreground hover:text-foreground py-0.5 px-1.5 rounded hover:bg-accent/30 transition-colors truncate"
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
      <div className="flex-1 min-w-0 p-4">
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
