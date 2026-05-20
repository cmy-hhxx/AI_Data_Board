import { useEffect, useState } from 'react'
import { useBoard } from '../../contexts/BoardContext'
import { api } from '../../lib/api'
import { ArrowLeft, Undo2, FolderOpen } from 'lucide-react'
import type { BoardColumn, Project, Task } from '@ai-data-board/shared'

export function ArchivedView() {
  const { state, dispatch } = useBoard()
  const [archivedProjects, setArchivedProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [restoringId, setRestoringId] = useState<string | null>(null)
  const [viewingProjectId, setViewingProjectId] = useState<string | null>(null)
  const [viewColumns, setViewColumns] = useState<BoardColumn[]>([])
  const [viewTasks, setViewTasks] = useState<Task[]>([])
  const [viewLoading, setViewLoading] = useState(false)

  useEffect(() => {
    api.projects.listArchived()
      .then(setArchivedProjects)
      .catch(err => setError(err instanceof Error ? err.message : 'Unknown error'))
      .finally(() => setLoading(false))
  }, [])

  const handleRestore = async (id: string) => {
    if (restoringId) return
    setRestoringId(id)
    try {
      const updated = await api.projects.restore(id)
      dispatch({ type: 'ADD_PROJECT', payload: updated })
      setArchivedProjects(prev => prev.filter(p => p.id !== id))
    } finally {
      setRestoringId(null)
    }
  }

  const handleViewProject = async (projectId: string) => {
    setViewingProjectId(projectId)
    setViewLoading(true)
    try {
      const [columns, tasks] = await Promise.all([
        api.columns.list(projectId),
        api.tasks.list(projectId),
      ])
      setViewColumns(columns.sort((a, b) => a.position - b.position))
      setViewTasks(tasks)
    } finally {
      setViewLoading(false)
    }
  }

  const handleBackToList = () => {
    setViewingProjectId(null)
    setViewColumns([])
    setViewTasks([])
  }

  const handleRestoreFromView = async () => {
    if (!viewingProjectId || restoringId) return
    setRestoringId(viewingProjectId)
    try {
      const updated = await api.projects.restore(viewingProjectId)
      dispatch({ type: 'ADD_PROJECT', payload: updated })
      setArchivedProjects(prev => prev.filter(p => p.id !== viewingProjectId))
      handleBackToList()
    } finally {
      setRestoringId(null)
    }
  }

  if (loading) {
    return (
      <div className="min-h-full px-8 py-8 max-w-6xl mx-auto flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-muted-foreground/20 border-t-muted-foreground rounded-full animate-spin" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-full px-8 py-8 max-w-6xl mx-auto flex items-center justify-center">
        <p className="text-sm text-muted-foreground">加载失败: {error}</p>
      </div>
    )
  }

  if (archivedProjects.length === 0) {
    return (
      <div className="min-h-full px-8 py-8 max-w-6xl mx-auto">
        <div className="flex items-center gap-3 mb-5">
          <h2 className="text-base font-semibold text-foreground">已归档</h2>
        </div>
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center mb-3">
            <FolderOpen className="w-6 h-6 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium text-foreground mb-1">暂无已归档项目</p>
          <p className="text-xs text-muted-foreground">归档后的项目会显示在这里</p>
        </div>
      </div>
    )
  }

  // Read-only archived project view
  if (viewingProjectId) {
    const viewingProject = archivedProjects.find(p => p.id === viewingProjectId)
    const sortedColumns = [...viewColumns].sort((a, b) => a.position - b.position)

    if (viewLoading) {
      return (
        <div className="min-h-full px-8 py-8 max-w-6xl mx-auto flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-muted-foreground/20 border-t-muted-foreground rounded-full animate-spin" />
        </div>
      )
    }

    return (
      <div className="min-h-full px-8 py-8 max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <button
              onClick={handleBackToList}
              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              返回归档列表
            </button>
            <h2 className="text-base font-semibold text-foreground">
              {viewingProject?.name ?? '已归档项目'}
            </h2>
          </div>
          <button
            onClick={handleRestoreFromView}
            disabled={restoringId === viewingProjectId}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg transition-colors cursor-pointer disabled:opacity-50"
            title="恢复项目"
          >
            <Undo2 className="w-3.5 h-3.5" />
            {restoringId === viewingProjectId ? '恢复中…' : '恢复'}
          </button>
        </div>

        {/* Read-only columns */}
        <div className="flex gap-3.5 items-start overflow-x-auto pb-4">
          {sortedColumns.map(col => {
            const colTasks = viewTasks
              .filter(t => t.columnId === col.id)
              .sort((a, b) => a.position - b.position)

            return (
              <div key={col.id} className="flex-shrink-0 w-64">
                <div className="bg-card border border-border rounded-xl overflow-hidden">
                  {/* Column header */}
                  <div className="px-3 py-2 border-b border-border">
                    <div className="flex items-center gap-2">
                      {col.color && (
                        <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: col.color }} />
                      )}
                      <h3 className="text-sm font-medium text-foreground truncate">{col.name}</h3>
                      <span className="text-xs text-muted-foreground ml-auto shrink-0">{colTasks.length}</span>
                    </div>
                  </div>

                  {/* Tasks */}
                  <div className="p-2 space-y-1.5 max-h-[calc(100vh-12rem)] overflow-y-auto">
                    {colTasks.length === 0 && (
                      <p className="text-xs text-muted-foreground text-center py-4">暂无任务</p>
                    )}
                    {colTasks.map(task => {
                      const priorityColors: Record<string, string> = {
                        urgent: 'bg-red-100 text-red-700',
                        high: 'bg-orange-100 text-orange-700',
                        medium: 'bg-yellow-100 text-yellow-700',
                        low: 'bg-blue-100 text-blue-700',
                      }
                      return (
                        <div
                          key={task.id}
                          className="rounded-lg border border-border bg-card/60 p-2.5"
                        >
                          <div className="flex items-start gap-2">
                            <span className="text-sm text-foreground leading-tight flex-1 min-w-0 break-words">
                              {task.title}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-2">
                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${priorityColors[task.priority] ?? 'bg-gray-100 text-gray-700'}`}>
                              {task.priority === 'urgent' ? '紧急' : task.priority === 'high' ? '高' : task.priority === 'medium' ? '中' : '低'}
                            </span>
                            {task.assignee && (
                              <span className="text-[10px] text-muted-foreground truncate">{task.assignee}</span>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            )
          })}

          {sortedColumns.length === 0 && (
            <div className="flex items-center justify-center w-full py-16">
              <p className="text-sm text-muted-foreground">该项目暂无列</p>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-full px-8 py-8 max-w-6xl mx-auto">
      <div className="flex items-center gap-3 mb-5">
        <h2 className="text-base font-semibold text-foreground">已归档</h2>
        <p className="text-xs text-muted-foreground">共 {archivedProjects.length} 个项目</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {archivedProjects.map(project => {
          return (
            <div
              key={project.id}
              onClick={() => handleViewProject(project.id)}
              className="group relative flex h-40 bg-card/60 border border-border rounded-xl opacity-60 hover:opacity-80 hover:border-muted-foreground/20 transition-all duration-200 overflow-hidden cursor-pointer"
            >
              {/* Card body */}
              <div className="flex-1 flex flex-col justify-center px-4 py-3 min-w-0">
                <span className="font-medium text-sm text-muted-foreground truncate leading-tight">
                  {project.name}
                </span>
                {project.archivedAt && (
                  <span className="text-xs text-muted-foreground/60 mt-1">
                    归档于 {new Date(project.archivedAt).toLocaleDateString('zh-CN')}
                  </span>
                )}
              </div>

              {/* Hover restore button */}
              <div className="absolute bottom-0 right-0 flex items-center justify-end gap-1 px-3 py-2 opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-t from-card/90 to-transparent">
                <button
                  onClick={(e) => { e.stopPropagation(); handleRestore(project.id); }}
                  disabled={restoringId === project.id}
                  className="flex items-center gap-1.5 p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors cursor-pointer text-xs disabled:opacity-50"
                  title="恢复项目"
                  aria-label="恢复项目"
                >
                  <Undo2 className="w-3.5 h-3.5" />
                  {restoringId === project.id ? '恢复中…' : '恢复'}
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
