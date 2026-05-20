import { useEffect, useState, useRef } from 'react'
import { useBoard } from '../../contexts/BoardContext'
import { api } from '../../lib/api'
import { Plus, ArrowRight, Trash2, Archive, FolderOpen } from 'lucide-react'
import { PersonnelOverview } from './PersonnelOverview'
import { PersonnelTimeline } from './PersonnelTimeline'
import type { PersonNode } from './PersonnelTimeline'

export function OverviewView() {
  const { state, dispatch } = useBoard()
  const [isAddingProject, setIsAddingProject] = useState(false)
  const [newProjectName, setNewProjectName] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [archiveTarget, setArchiveTarget] = useState<string | null>(null)
  const [isArchiving, setIsArchiving] = useState(false)
  const [archivedCount, setArchivedCount] = useState(0)
  const [selectedPersonId, setSelectedPersonId] = useState<string | undefined>()

  const [timelinePeople, setTimelinePeople] = useState<PersonNode[]>([])
  const [timelineLoading, setTimelineLoading] = useState(true)
  const [timelineError, setTimelineError] = useState<string | null>(null)

  const addInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isAddingProject && addInputRef.current) {
      addInputRef.current.focus()
    }
  }, [isAddingProject])

  // Load archived count
  useEffect(() => {
    api.projects.listArchived().then(projects => setArchivedCount(projects.length)).catch(() => {})
  }, [state.projects.length])

  // Load timeline data for personnel ranking + Gantt
  useEffect(() => {
    api.timeline.get()
      .then((data) => {
        if (data && data.people) {
          setTimelinePeople(data.people.filter((p) => p.projects.length > 0))
        }
      })
      .catch((err) => setTimelineError(err instanceof Error ? err.message : 'Unknown error'))
      .finally(() => setTimelineLoading(false))
  }, [])


  const handleCreateProject = async () => {
    if (!newProjectName.trim() || isCreating) return
    setIsCreating(true)
    try {
      const project = await api.projects.create({ name: newProjectName.trim() })
      dispatch({ type: 'ADD_PROJECT', payload: project })
      setNewProjectName('')
      setIsAddingProject(false)
    } finally {
      setIsCreating(false)
    }
  }

  const handleDeleteProject = async () => {
    if (!deleteTarget || isDeleting) return
    setIsDeleting(true)
    try {
      await api.projects.delete(deleteTarget)
      dispatch({ type: 'REMOVE_PROJECT', payload: deleteTarget })
    } finally {
      setIsDeleting(false)
      setDeleteTarget(null)
    }
  }

  const handleArchiveProject = async () => {
    if (!archiveTarget || isArchiving) return
    setIsArchiving(true)
    try {
      await api.projects.archive(archiveTarget)
      dispatch({ type: 'REMOVE_PROJECT', payload: archiveTarget })
      setArchivedCount(c => c + 1)
    } finally {
      setIsArchiving(false)
      setArchiveTarget(null)
    }
  }

  const handleSelectProject = (projectId: string) => {
    dispatch({ type: 'SET_CURRENT_PROJECT', payload: projectId })
  }

  const deleteTargetProject = state.projects.find(p => p.id === deleteTarget)
  const archiveTargetProject = state.projects.find(p => p.id === archiveTarget)

  const allTasksCount = state.projects.reduce((sum, p) => sum + (p.taskCount ?? 0), 0)

  return (
    <div className="min-h-full px-6 py-6 max-w-[1600px] mx-auto">
      {/* ===== TOP SECTION: Project List + Personnel Ranking ===== */}
      <div className="flex gap-6 mb-6">
        {/* Left: Project List */}
        <div className="flex-[3] min-w-0">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <h2 className="text-sm font-semibold text-foreground">项目</h2>
              <p className="text-xs text-muted-foreground">
                {state.projects.length > 0
                  ? `共 ${state.projects.length} 个项目 / ${allTasksCount} 个任务`
                  : '还没有项目'}
              </p>
              {archivedCount > 0 && (
                <button
                  onClick={() => dispatch({ type: 'SET_VIEW', payload: 'archived' })}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                >
                  已归档 ({archivedCount})
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {state.projects.map(project => {
              const taskCount = project.taskCount ?? 0
              const hasTasks = taskCount > 0
              return (
                <div
                  key={project.id}
                  className="group relative border border-border/40 rounded-lg bg-card hover:border-border hover:shadow-sm transition-all cursor-pointer"
                  role="button"
                  tabIndex={0}
                  onClick={() => handleSelectProject(project.id)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleSelectProject(project.id) } }}
                >
                  {/* Hover actions */}
                  <div className="absolute top-2 right-2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                    <button
                      onClick={(e) => { e.stopPropagation(); setArchiveTarget(project.id) }}
                      className="p-1 rounded text-muted-foreground/60 hover:text-foreground hover:bg-accent transition-colors cursor-pointer"
                      title="归档项目"
                      aria-label="归档项目"
                    >
                      <Archive className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setDeleteTarget(project.id) }}
                      className="p-1 rounded text-muted-foreground/60 hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
                      title="删除项目"
                      aria-label="删除项目"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    <ArrowRight className="w-3.5 h-3.5 text-muted-foreground/30 ml-0.5" />
                  </div>

                  <div className="p-4">
                    {/* Project name */}
                    <h3 className="text-sm font-medium text-foreground truncate pr-16 mb-2">
                      {project.name}
                    </h3>

                    {/* Task count + progress indicator */}
                    <div className="flex items-center gap-2 mb-3">
                      <span className={`w-2 h-2 rounded-full ${hasTasks ? 'bg-emerald-400' : 'bg-muted-foreground/25'}`} />
                      <span className="text-xs text-muted-foreground">
                        {taskCount} 个任务
                      </span>
                    </div>

                    {/* Members avatars */}
                    {project.members && project.members.length > 0 && (
                      <div className="flex items-center gap-0.5">
                        {project.members.slice(0, 2).map(m => (
                          <div
                            key={m.id}
                            className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-[10px] font-medium text-muted-foreground ring-1 ring-border/50"
                            title={m.name}
                          >
                            {m.name.charAt(0)}
                          </div>
                        ))}
                        {project.members.length > 2 && (
                          <span className="text-[10px] text-muted-foreground ml-1">
                            +{project.members.length - 2}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}

            {/* Create form card */}
            {isAddingProject ? (
              <div className="border border-border/40 rounded-lg bg-card p-4">
                <input
                  ref={addInputRef}
                  value={newProjectName}
                  onChange={e => setNewProjectName(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleCreateProject()
                    if (e.key === 'Escape') { setIsAddingProject(false); setNewProjectName('') }
                  }}
                  placeholder="输入项目名称…"
                  className="w-full h-8 px-2.5 text-sm border border-border rounded-md bg-background outline-none focus:border-primary/40 transition-colors mb-3"
                />
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCreateProject}
                    disabled={isCreating || !newProjectName.trim()}
                    className="h-7 px-3 text-xs font-medium bg-primary text-primary-foreground rounded-md disabled:opacity-50 hover:opacity-90 transition-opacity cursor-pointer"
                  >
                    {isCreating ? '创建中…' : '创建'}
                  </button>
                  <button
                    onClick={() => { setIsAddingProject(false); setNewProjectName('') }}
                    className="h-7 px-2.5 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                  >
                    取消
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setIsAddingProject(true)}
                className="border border-dashed border-border/60 rounded-lg bg-card/50 hover:bg-accent/20 hover:border-border transition-all cursor-pointer flex flex-col items-center justify-center py-8 gap-2 min-h-[120px]"
              >
                <Plus className="w-5 h-5 text-muted-foreground/50" />
                <span className="text-xs text-muted-foreground">新建项目</span>
              </button>
            )}

            {/* Empty state (no projects, not adding) */}
            {state.projects.length === 0 && !isAddingProject && (
              <div className="col-span-full flex flex-col items-center justify-center py-12 text-center border border-dashed border-border rounded-lg">
                <FolderOpen className="w-8 h-8 text-muted-foreground/40 mb-2" />
                <p className="text-sm text-muted-foreground mb-1">还没有项目</p>
                <p className="text-xs text-muted-foreground/60">点击右侧按钮创建第一个项目</p>
              </div>
            )}
          </div>
        </div>

        {/* Right: Personnel Ranking */}
        <div className="flex-[2] min-w-0">
          <h2 className="text-sm font-semibold text-foreground mb-3">人员工作总览</h2>
          <div className="border border-border/40 rounded-lg p-3">
            <PersonnelOverview
              selectedPersonId={selectedPersonId}
              onPersonSelect={setSelectedPersonId}
            />
          </div>
        </div>
      </div>

      {/* ===== BOTTOM SECTION: Gantt Timeline ===== */}
      <div>
        <PersonnelTimeline
          people={timelinePeople}
          highlightPersonId={selectedPersonId}
          onPersonSelect={setSelectedPersonId}
          loading={timelineLoading}
          error={timelineError}
        />
      </div>

      {/* Archive confirmation dialog */}
      {archiveTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm"
          onClick={() => setArchiveTarget(null)}
        >
          <div
            className="bg-card border border-border rounded-xl p-6 shadow-xl max-w-sm w-full mx-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-start gap-3 mb-4">
              <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                <Archive className="w-4.5 h-4.5 text-muted-foreground" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-1">归档项目</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  归档 <span className="font-medium text-foreground">「{archiveTargetProject?.name}」</span>
                  {' '}后将从总览移除，可在已归档页面查看和恢复。
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setArchiveTarget(null)}
                className="h-8 px-4 text-xs font-medium text-muted-foreground hover:text-foreground border border-border rounded-lg hover:bg-accent transition-colors cursor-pointer"
              >
                取消
              </button>
              <button
                onClick={handleArchiveProject}
                disabled={isArchiving}
                className="h-8 px-4 text-xs font-medium bg-primary text-primary-foreground rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity cursor-pointer"
              >
                {isArchiving ? '归档中…' : '确认归档'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation dialog */}
      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm"
          onClick={() => setDeleteTarget(null)}
        >
          <div
            className="bg-card border border-border rounded-xl p-6 shadow-xl max-w-sm w-full mx-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-start gap-3 mb-4">
              <div className="w-9 h-9 rounded-lg bg-destructive/10 flex items-center justify-center shrink-0">
                <Trash2 className="w-4.5 h-4.5 text-destructive" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-1">删除项目</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  将删除项目 <span className="font-medium text-foreground">「{deleteTargetProject?.name}」</span>
                  及其所有列和任务，此操作不可恢复。
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setDeleteTarget(null)}
                className="h-8 px-4 text-xs font-medium text-muted-foreground hover:text-foreground border border-border rounded-lg hover:bg-accent transition-colors cursor-pointer"
              >
                取消
              </button>
              <button
                onClick={handleDeleteProject}
                disabled={isDeleting}
                className="h-8 px-4 text-xs font-medium bg-destructive text-destructive-foreground rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity cursor-pointer"
              >
                {isDeleting ? '删除中…' : '确认删除'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
