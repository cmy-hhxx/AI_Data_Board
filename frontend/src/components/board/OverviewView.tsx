import { useEffect, useState, useRef } from 'react'
import { useBoard } from '../../contexts/BoardContext'
import { api } from '../../lib/api'
import { Plus, CheckCircle2, Circle, AlertCircle, Zap, ArrowRight } from 'lucide-react'
import { cn } from '../../lib/utils'
import type { Task, Priority } from '@ai-data-board/shared'

const PRIORITY_ORDER: Priority[] = ['urgent', 'high', 'medium', 'low']

const PRIORITY_LABEL: Record<Priority, string> = {
  urgent: '紧急',
  high: '高',
  medium: '中',
  low: '低',
}

const PRIORITY_COLORS: Record<Priority, string> = {
  urgent: 'text-red-500 bg-red-50',
  high: 'text-orange-500 bg-orange-50',
  medium: 'text-yellow-600 bg-yellow-50',
  low: 'text-slate-400 bg-slate-100',
}

const PRIORITY_DOT: Record<Priority, string> = {
  urgent: 'bg-red-500',
  high: 'bg-orange-400',
  medium: 'bg-yellow-400',
  low: 'bg-slate-300',
}

function PriorityBadge({ priority }: { priority: Priority }) {
  return (
    <span className={cn('inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium', PRIORITY_COLORS[priority])}>
      <span className={cn('w-1.5 h-1.5 rounded-full', PRIORITY_DOT[priority])} />
      {PRIORITY_LABEL[priority]}
    </span>
  )
}

interface ProjectTaskData {
  tasks: Task[]
  loading: boolean
}

const PROJECT_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e',
  '#f97316', '#eab308', '#22c55e', '#14b8a6', '#0ea5e9',
]

export function OverviewView() {
  const { state, dispatch } = useBoard()
  const [projectTasks, setProjectTasks] = useState<Record<string, ProjectTaskData>>({})
  const [showTasksExpanded, setShowTasksExpanded] = useState(false)
  const [isAddingProject, setIsAddingProject] = useState(false)
  const [newProjectName, setNewProjectName] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const addInputRef = useRef<HTMLInputElement>(null)

  // Parallel-fetch tasks for all projects
  useEffect(() => {
    if (state.projects.length === 0) return

    // Initialize loading states
    const initial: Record<string, ProjectTaskData> = {}
    state.projects.forEach(p => { initial[p.id] = { tasks: [], loading: true } })
    setProjectTasks(initial)

    state.projects.forEach(project => {
      api.tasks.list(project.id).then(tasks => {
        setProjectTasks(prev => ({
          ...prev,
          [project.id]: { tasks, loading: false },
        }))
      }).catch(() => {
        setProjectTasks(prev => ({
          ...prev,
          [project.id]: { tasks: [], loading: false },
        }))
      })
    })
  }, [state.projects])

  useEffect(() => {
    if (isAddingProject && addInputRef.current) {
      addInputRef.current.focus()
    }
  }, [isAddingProject])

  const handleCreateProject = async () => {
    if (!newProjectName.trim() || isCreating) return
    setIsCreating(true)
    try {
      const color = PROJECT_COLORS[state.projects.length % PROJECT_COLORS.length]
      const project = await api.projects.create({ name: newProjectName.trim(), color })
      dispatch({ type: 'ADD_PROJECT', payload: project })
      setNewProjectName('')
      setIsAddingProject(false)
    } finally {
      setIsCreating(false)
    }
  }

  const handleSelectProject = (projectId: string) => {
    dispatch({ type: 'SET_CURRENT_PROJECT', payload: projectId })
  }

  // Aggregate all tasks across all projects, sorted by priority
  const allTasks: (Task & { projectName: string; projectColor: string | null })[] = []
  state.projects.forEach(project => {
    const data = projectTasks[project.id]
    if (data && !data.loading) {
      data.tasks.forEach(task => {
        allTasks.push({ ...task, projectName: project.name, projectColor: project.color })
      })
    }
  })
  allTasks.sort((a, b) => {
    const ap = PRIORITY_ORDER.indexOf(a.priority)
    const bp = PRIORITY_ORDER.indexOf(b.priority)
    if (ap !== bp) return ap - bp
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  })

  const TASK_LIMIT = 30
  const visibleTasks = showTasksExpanded ? allTasks : allTasks.slice(0, TASK_LIMIT)
  const tasksLoadingCount = Object.values(projectTasks).filter(d => d.loading).length

  return (
    <div className="min-h-full px-8 py-8 max-w-6xl mx-auto">

      {/* Projects section */}
      <div className="mb-10">
        <h2 className="text-xs font-semibold text-muted-foreground/70 uppercase tracking-wider mb-4">项目</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {/* Project cards */}
          {state.projects.map(project => {
            const data = projectTasks[project.id]
            const tasks = data?.tasks ?? []
            const total = tasks.length
            const done = tasks.filter(t => {
              // Heuristic: tasks without a columnId or with "done"/"完成" in their position are "done"
              // We don't have column names here, so just use total for now
              return false
            }).length
            const accentColor = project.color ?? '#6366f1'

            return (
              <button
                key={project.id}
                onClick={() => handleSelectProject(project.id)}
                className="group relative flex flex-col gap-3 p-4 bg-white border border-border/60 rounded-xl text-left hover:border-border hover:shadow-md transition-all duration-150"
              >
                {/* Color accent bar */}
                <div className="absolute top-0 left-0 right-0 h-0.5 rounded-t-xl" style={{ backgroundColor: accentColor }} />

                <div className="flex items-start justify-between gap-2 pt-1">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold shrink-0"
                      style={{ backgroundColor: accentColor }}>
                      {project.name.charAt(0).toUpperCase()}
                    </span>
                    <span className="font-medium text-sm text-foreground truncate">{project.name}</span>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-muted-foreground/0 group-hover:text-muted-foreground/60 transition-colors shrink-0 mt-0.5" />
                </div>

                {/* Task count */}
                {data?.loading ? (
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-full rounded-full bg-accent animate-pulse" />
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Circle className="w-3 h-3" />
                      <span>{total} 个任务</span>
                    </div>
                    {total > 0 && (
                      <>
                        <div className="h-1 flex-1 bg-accent rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{ width: `${done === 0 ? 5 : Math.round((done / total) * 100)}%`, backgroundColor: accentColor, opacity: 0.6 }}
                          />
                        </div>
                      </>
                    )}
                  </div>
                )}

                {/* Priority breakdown */}
                {!data?.loading && total > 0 && (() => {
                  const urgentCount = tasks.filter(t => t.priority === 'urgent').length
                  const highCount = tasks.filter(t => t.priority === 'high').length
                  return (urgentCount > 0 || highCount > 0) ? (
                    <div className="flex items-center gap-2 flex-wrap">
                      {urgentCount > 0 && (
                        <span className="flex items-center gap-1 text-[10px] text-red-500">
                          <AlertCircle className="w-3 h-3" />
                          {urgentCount} 紧急
                        </span>
                      )}
                      {highCount > 0 && (
                        <span className="flex items-center gap-1 text-[10px] text-orange-500">
                          <Zap className="w-3 h-3" />
                          {highCount} 高优
                        </span>
                      )}
                    </div>
                  ) : null
                })()}
              </button>
            )
          })}

          {/* New project card */}
          {isAddingProject ? (
            <div className="flex flex-col gap-2 p-4 bg-white border border-border rounded-xl">
              <input
                ref={addInputRef}
                value={newProjectName}
                onChange={e => setNewProjectName(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') handleCreateProject()
                  if (e.key === 'Escape') { setIsAddingProject(false); setNewProjectName('') }
                }}
                placeholder="项目名称"
                className="h-8 px-2.5 text-sm border border-border/60 rounded-lg bg-background outline-none focus:border-foreground/30 w-full"
              />
              <div className="flex items-center gap-1.5">
                <button
                  onClick={handleCreateProject}
                  disabled={isCreating || !newProjectName.trim()}
                  className="h-7 px-3 text-xs font-medium bg-foreground text-background rounded-md disabled:opacity-50"
                >
                  {isCreating ? '创建中...' : '创建'}
                </button>
                <button
                  onClick={() => { setIsAddingProject(false); setNewProjectName('') }}
                  className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                >
                  取消
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setIsAddingProject(true)}
              className="flex items-center justify-center gap-2 p-4 border border-dashed border-border/80 rounded-xl text-sm text-muted-foreground hover:text-foreground hover:border-border hover:bg-accent/40 transition-all duration-150 min-h-[88px]"
            >
              <Plus className="w-4 h-4" />
              <span>新建项目</span>
            </button>
          )}
        </div>

        {/* Empty state */}
        {state.projects.length === 0 && !isAddingProject && (
          <p className="text-center text-xs text-muted-foreground/50 mt-8">点击「新建项目」开始</p>
        )}
      </div>

      {/* Global tasks section */}
      {(allTasks.length > 0 || tasksLoadingCount > 0) && (
        <div>
          <h2 className="text-xs font-semibold text-muted-foreground/70 uppercase tracking-wider mb-4">全部任务</h2>

          <div className="bg-white border border-border/60 rounded-xl overflow-hidden">
            {tasksLoadingCount > 0 && allTasks.length === 0 ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-4 h-4 border-2 border-border border-t-foreground/40 rounded-full animate-spin" />
              </div>
            ) : (
              <>
                <div className="divide-y divide-border/50">
                  {visibleTasks.map(task => (
                    <div
                      key={task.id}
                      className="flex items-center gap-3 px-4 py-2.5 hover:bg-accent/40 transition-colors"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 text-muted-foreground/30 shrink-0" />
                      <span className="flex-1 text-sm text-foreground/90 truncate">{task.title}</span>
                      <div className="flex items-center gap-2 shrink-0">
                        {task.projectColor ? (
                          <span
                            className="inline-flex items-center h-5 px-2 rounded-full text-[10px] font-medium text-white"
                            style={{ backgroundColor: task.projectColor }}
                          >
                            {task.projectName}
                          </span>
                        ) : (
                          <span className="inline-flex items-center h-5 px-2 rounded-full text-[10px] font-medium bg-accent text-muted-foreground">
                            {task.projectName}
                          </span>
                        )}
                        <PriorityBadge priority={task.priority} />
                      </div>
                    </div>
                  ))}
                </div>

                {allTasks.length > TASK_LIMIT && (
                  <div className="border-t border-border/50 px-4 py-2.5">
                    <button
                      onClick={() => setShowTasksExpanded(!showTasksExpanded)}
                      className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showTasksExpanded
                        ? '收起'
                        : `查看全部 ${allTasks.length} 条任务`}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
