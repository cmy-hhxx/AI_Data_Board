import { useState, useRef, useEffect, useCallback } from 'react'
import { Plus, Archive, FolderOpen } from 'lucide-react'
import { useBoard } from '../../contexts/BoardContext'
import { api } from '../../lib/api'
import { ProjectCard } from './ProjectCard'
import type { Project } from '@ai-data-board/shared'

interface Props {
  projects: Project[]
  archivedCount: number
  onSelectProject: (id: string) => void
  onArchiveProject: (id: string) => void
  onDeleteProject: (id: string) => void
}

export function ProjectPool({
  projects,
  archivedCount,
  onSelectProject,
  onArchiveProject,
  onDeleteProject,
}: Props) {
  const { dispatch } = useBoard()
  const [isAddingProject, setIsAddingProject] = useState(false)
  const [newProjectName, setNewProjectName] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const addInputRef = useRef<HTMLInputElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [hasOverflow, setHasOverflow] = useState(false)

  useEffect(() => {
    if (isAddingProject && addInputRef.current) {
      addInputRef.current.focus()
    }
  }, [isAddingProject])

  const checkOverflow = useCallback(() => {
    const el = scrollRef.current
    if (el) {
      setHasOverflow(el.scrollHeight > el.clientHeight)
    }
  }, [])

  useEffect(() => {
    checkOverflow()
  }, [projects.length, isAddingProject, checkOverflow])

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

  const allTasksCount = projects.reduce((sum, p) => sum + (p.taskCount ?? 0), 0)

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 shrink-0">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-semibold text-foreground">项目</h2>
          <p className="text-xs text-muted-foreground">
            {projects.length > 0
              ? `共 ${projects.length} 个项目 / ${allTasksCount} 个任务`
              : '还没有项目'}
          </p>
        </div>
        <button
          onClick={() => dispatch({ type: 'SET_VIEW', payload: 'archived' })}
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground bg-muted/50 hover:bg-accent border border-border/30 hover:border-border/60 rounded-md px-2.5 py-1 transition-all duration-150 cursor-pointer"
        >
          <Archive className="w-3 h-3" />
          已归档 ({archivedCount})
        </button>
      </div>

      {/* Scrollable grid */}
      <div className="flex-1 relative min-h-0">
        <div
          ref={scrollRef}
          className="h-full overflow-y-auto overscroll-contain pr-1"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {projects.map(project => (
              <ProjectCard
                key={project.id}
                project={project}
                onClick={() => onSelectProject(project.id)}
                onArchive={() => onArchiveProject(project.id)}
                onDelete={() => onDeleteProject(project.id)}
              />
            ))}

            {/* Create form card */}
            {isAddingProject ? (
              <div className="border border-border/40 rounded-lg bg-card p-4 h-[150px]">
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
                className="border border-dashed border-border/60 rounded-lg bg-card/50 hover:bg-accent/20 hover:border-border transition-all cursor-pointer flex flex-col items-center justify-center gap-2 h-[150px]"
              >
                <Plus className="w-5 h-5 text-muted-foreground/50" />
                <span className="text-xs text-muted-foreground">新建项目</span>
              </button>
            )}

            {/* Empty state (no projects, not adding) */}
            {projects.length === 0 && !isAddingProject && (
              <div className="col-span-full flex flex-col items-center justify-center py-12 text-center border border-dashed border-border rounded-lg">
                <FolderOpen className="w-8 h-8 text-muted-foreground/40 mb-2" />
                <p className="text-sm text-muted-foreground mb-1">还没有项目</p>
                <p className="text-xs text-muted-foreground/60">点击右侧按钮创建第一个项目</p>
              </div>
            )}
          </div>
        </div>

        {/* Bottom fade-out mask when overflow */}
        {hasOverflow && (
          <div
            className="absolute bottom-0 left-0 right-0 h-12 pointer-events-none rounded-b-lg"
            style={{
              background: 'linear-gradient(to bottom, transparent, hsl(var(--card)))',
            }}
          />
        )}
      </div>
    </div>
  )
}
