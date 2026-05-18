import { useEffect, useState, useRef } from 'react'
import { useBoard } from '../../contexts/BoardContext'
import { api } from '../../lib/api'
import { Plus, ArrowRight, Trash2, FolderOpen } from 'lucide-react'
import { PersonnelTimeline } from './PersonnelTimeline'

export function OverviewView() {
  const { state, dispatch } = useBoard()
  const [isAddingProject, setIsAddingProject] = useState(false)
  const [newProjectName, setNewProjectName] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const addInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isAddingProject && addInputRef.current) {
      addInputRef.current.focus()
    }
  }, [isAddingProject])

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

  const handleSelectProject = (projectId: string) => {
    dispatch({ type: 'SET_CURRENT_PROJECT', payload: projectId })
  }

  const deleteTargetProject = state.projects.find(p => p.id === deleteTarget)

  return (
    <div className="min-h-full px-8 py-8 max-w-6xl mx-auto">

      {/* Section header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-base font-semibold text-foreground">项目</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {state.projects.length > 0
              ? `共 ${state.projects.length} 个项目`
              : '还没有项目，新建一个开始'}
          </p>
        </div>
        {!isAddingProject && (
          <button
            onClick={() => setIsAddingProject(true)}
            className="flex items-center gap-1.5 h-8 px-3 text-xs font-medium bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            新建项目
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-12">
        {state.projects.map(project => {
          const accentColor = project.color || '#94a3b8'
          return (
            <div
              key={project.id}
              role="button"
              tabIndex={0}
              onClick={() => handleSelectProject(project.id)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleSelectProject(project.id) } }}
              className="group relative flex items-center gap-3.5 p-4 bg-card border border-border rounded-xl hover:border-border/80 hover:shadow-[0_4px_16px_rgba(0,0,0,.08)] transition-all duration-200 cursor-pointer"
            >
              {/* Avatar */}
              <span
                className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-bold shrink-0"
                style={{ backgroundColor: accentColor }}
              >
                {project.name.charAt(0).toUpperCase()}
              </span>

              {/* Name */}
              <span className="font-medium text-sm text-foreground truncate flex-1 leading-tight">
                {project.name}
              </span>

              {/* Actions on hover */}
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                <button
                  onClick={(e) => { e.stopPropagation(); setDeleteTarget(project.id) }}
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
                  title="删除项目"
                  aria-label="删除项目"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
                <span className="text-muted-foreground/40">
                  <ArrowRight className="w-3.5 h-3.5" />
                </span>
              </div>
            </div>
          )
        })}

        {/* Add project inline card */}
        {isAddingProject ? (
          <div className="flex flex-col gap-2.5 p-4 bg-card border border-primary/30 rounded-xl shadow-sm ring-1 ring-primary/10">
            <input
              ref={addInputRef}
              value={newProjectName}
              onChange={e => setNewProjectName(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') handleCreateProject()
                if (e.key === 'Escape') { setIsAddingProject(false); setNewProjectName('') }
              }}
              placeholder="输入项目名称…"
              className="h-8 px-2.5 text-sm border border-border rounded-lg bg-background outline-none focus:border-primary/40 transition-colors w-full"
            />
            <div className="flex items-center gap-1.5">
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
            className="flex items-center justify-center gap-2 p-4 border border-dashed border-border rounded-xl text-sm text-muted-foreground hover:text-foreground hover:border-muted-foreground/40 hover:bg-accent/40 transition-all duration-150 min-h-[66px] cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>新建项目</span>
          </button>
        )}
      </div>

      {/* Empty state */}
      {state.projects.length === 0 && !isAddingProject && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center mb-3">
            <FolderOpen className="w-6 h-6 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium text-foreground mb-1">还没有项目</p>
          <p className="text-xs text-muted-foreground">点击右上角「新建项目」开始</p>
        </div>
      )}

      {/* Personnel Timeline */}
      <PersonnelTimeline />

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
