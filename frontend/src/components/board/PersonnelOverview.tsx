import { useEffect, useState, useMemo } from 'react'
import { api } from '../../lib/api'
import { cn } from '../../lib/utils'

type Priority = 'low' | 'medium' | 'high' | 'urgent'

const priorityDotColor = (priority: Priority): string => {
  const colors: Record<Priority, string> = {
    urgent: '#e05555',  // muted red — in sync with GanttView
    high: '#8b64c8',  // soft purple
    medium: '#c89a35',  // warm amber
    low: '#94a3b8',  // slate-gray
  }
  return colors[priority]
}

function workloadColor(taskCount: number): string {
  if (taskCount >= 10) return 'hsl(var(--priority-urgent))'
  if (taskCount >= 7)  return 'hsl(var(--priority-high))'
  if (taskCount >= 4)  return 'hsl(var(--priority-medium))'
  return 'hsl(var(--priority-low))'
}

function workloadLevel(taskCount: number): string {
  if (taskCount >= 10) return '超负荷'
  if (taskCount >= 7)  return '高负载'
  if (taskCount >= 4)  return '适中'
  return '轻量'
}

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

interface Props {
  selectedPersonId?: string
  onPersonSelect?: (id: string) => void
  className?: string
}

export function PersonnelOverview({ selectedPersonId, onPersonSelect, className }: Props) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [people, setPeople] = useState<PersonNode[]>([])
  const [expandedPersonId, setExpandedPersonId] = useState<string | null>(null)

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

  const { sortedPeople, maxTasks } = useMemo(() => {
    let max = 0
    for (const person of people) {
      const totalTasks = person.projects.reduce((sum, p) => sum + p.tasks.length, 0)
      if (totalTasks > max) max = totalTasks
    }
    const sorted = [...people].sort((a, b) => {
      const aCount = a.projects.reduce((sum, p) => sum + p.tasks.length, 0)
      const bCount = b.projects.reduce((sum, p) => sum + p.tasks.length, 0)
      return bCount - aCount
    })
    return { sortedPeople: sorted, maxTasks: max }
  }, [people])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="w-5 h-5 border-2 border-muted-foreground/20 border-t-muted-foreground rounded-full animate-spin" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-8">
        <p className="text-xs text-muted-foreground">加载失败</p>
      </div>
    )
  }

  if (sortedPeople.length === 0) {
    return (
      <div className="flex items-center justify-center py-8">
        <p className="text-xs text-muted-foreground/60">暂无人员工作数据</p>
      </div>
    )
  }

  const renderPersonRow = (person: PersonNode, idx: number) => {
    const totalTasks = person.projects.reduce((sum, p) => sum + p.tasks.length, 0)
    const barWidth = maxTasks > 0 ? (totalTasks / maxTasks) * 100 : 0
    const isSelected = selectedPersonId === person.id
    const isExpanded = expandedPersonId === person.id

    return (
      <div key={person.id}>
        <button
          type="button"
          onClick={() => {
            onPersonSelect?.(person.id)
            setExpandedPersonId(isExpanded ? null : person.id)
          }}
          className={`w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md text-left transition-colors cursor-pointer ${isSelected
              ? 'bg-primary/10 ring-1 ring-primary/20'
              : 'hover:bg-accent/50'
            }`}
        >
          <span className="text-xs text-muted-foreground/50 w-5 text-right tabular-nums shrink-0">
            {idx + 1}
          </span>
          <span className={`text-sm truncate ${isSelected ? 'font-semibold text-foreground' : 'font-medium text-foreground/80'}`}>
            {person.name}
          </span>
          <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden shrink-0 min-w-[40px]">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${Math.max(barWidth, 2)}%`,
                backgroundColor: isSelected ? 'hsl(var(--primary))' : workloadColor(totalTasks),
              }}
            />
          </div>
          <span className={`text-xs tabular-nums shrink-0 ${isSelected ? 'text-primary font-semibold' : 'text-muted-foreground'}`}>
            {totalTasks}
            <span className="text-[10px] ml-0.5 opacity-60">{workloadLevel(totalTasks)}</span>
          </span>
        </button>
        {isExpanded && (
          <div className="ml-7.5 mt-1 mb-2 pl-3 border-l-2 border-border/30 space-y-0.5 max-h-60 overflow-y-auto">
            {person.projects.map(project =>
              project.tasks.map(task => (
                <div key={task.id} className="flex items-center gap-2 px-2 py-1 text-xs rounded hover:bg-accent/30 transition-colors">
                  <span className="shrink-0" style={{ color: priorityDotColor(task.priority) }}>●</span>
                  <span className="truncate flex-1">{task.title}</span>
                  <span className="text-muted-foreground/40 shrink-0 text-[10px]">{project.name}</span>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className={cn("space-y-0.5", className)}>
      {sortedPeople.map((person, idx) => renderPersonRow(person, idx))}
    </div>
  )
}
