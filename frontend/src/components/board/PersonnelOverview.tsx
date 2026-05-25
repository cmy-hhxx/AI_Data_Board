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
  role: string
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

  const { regularStaff, interns, maxTasks } = useMemo(() => {
    const regular: PersonNode[] = []
    const internList: PersonNode[] = []
    let max = 0

    for (const person of people) {
      const totalTasks = person.projects.reduce((sum, p) => sum + p.tasks.length, 0)
      if (totalTasks > max) max = totalTasks
      if (person.role === 'intern') {
        internList.push(person)
      } else {
        regular.push(person)
      }
    }

    const sortFn = (a: PersonNode, b: PersonNode) => {
      const aCount = a.projects.reduce((sum, p) => sum + p.tasks.length, 0)
      const bCount = b.projects.reduce((sum, p) => sum + p.tasks.length, 0)
      return bCount - aCount
    }

    return {
      regularStaff: regular.sort(sortFn),
      interns: internList.sort(sortFn),
      maxTasks: max,
    }
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

  if (regularStaff.length === 0 && interns.length === 0) {
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
          <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden shrink-0 min-w-[40px]">
            <div
              className={`h-full rounded-full transition-all duration-300 ${isSelected ? 'bg-primary' : 'bg-muted-foreground/30'}`}
              style={{ width: `${Math.max(barWidth, 2)}%` }}
            />
          </div>
          <span className={`text-xs tabular-nums shrink-0 ${isSelected ? 'text-primary font-semibold' : 'text-muted-foreground'}`}>
            {totalTasks}
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
      {regularStaff.map((person, idx) => renderPersonRow(person, idx))}

      {interns.length > 0 && (
        <>
          <div className="border-t border-border/30 my-1.5" />
          <div className="px-2 py-1 text-xs font-medium text-muted-foreground/50">
            实习生 ({interns.length}人 / {interns.reduce((sum, p) => sum + p.projects.reduce((s, pr) => s + pr.tasks.length, 0), 0)} 任务)
          </div>
          {interns.map((person, idx) => renderPersonRow(person, idx))}
        </>
      )}
    </div>
  )
}
