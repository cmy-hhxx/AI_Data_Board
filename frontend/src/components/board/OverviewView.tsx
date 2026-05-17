import { useEffect, useState, useRef } from 'react'
import { useBoard } from '../../contexts/BoardContext'
import { api } from '../../lib/api'
import { Plus, ArrowRight, Trash2 } from 'lucide-react'
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

  return (
    <div className="min-h-full px-8 py-8 max-w-6xl mx-auto">

      <div className="mb-10">
        <h2 className="text-xs font-semibold text-muted-foreground/70 uppercase tracking-wider mb-4">项目</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {state.projects.map(project => (
            <button
              key={project.id}
              onClick={() => handleSelectProject(project.id)}
              className="group relative flex items-center gap-3 p-4 bg-card border border-border/60 rounded-xl text-left hover:border-border hover:shadow-md transition-all duration-150"
            >
              {/* Delete button — top-left, visible on hover */}
              <button
                onClick={(e) => { e.stopPropagation(); setDeleteTarget(project.id) }}
                className="absolute -top-2 -left-2 w-5 h-5 rounded-full bg-muted border border-border flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-red-50 hover:border-red-200 hover:text-red-500 transition-all"
                title="删除项目"
              >
                <Trash2 className="w-2.5 h-2.5" />
              </button>

              <span className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold shrink-0 bg-muted-foreground/30">
                {project.name.charAt(0).toUpperCase()}
              </span>
              <span className="font-medium text-sm text-foreground truncate flex-1">{project.name}</span>
              <ArrowRight className="w-3.5 h-3.5 text-muted-foreground/0 group-hover:text-muted-foreground/60 transition-colors shrink-0" />
            </button>
          ))}

          {isAddingProject ? (
            <div className="flex flex-col gap-2 p-4 bg-card border border-border rounded-xl">
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
              className="flex items-center justify-center gap-2 p-4 border border-dashed border-border/80 rounded-xl text-sm text-muted-foreground hover:text-foreground hover:border-border hover:bg-accent/40 transition-all duration-150 min-h-[50px]"
            >
              <Plus className="w-4 h-4" />
              <span>新建项目</span>
            </button>
          )}
        </div>

        {state.projects.length === 0 && !isAddingProject && (
          <p className="text-center text-xs text-muted-foreground/50 mt-8">点击「新建项目」开始</p>
        )}
      </div>

      {/* Personnel Timeline */}
      <PersonnelTimeline />

      {/* Delete confirmation dialog */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20" onClick={() => setDeleteTarget(null)}>
          <div className="bg-card border border-border rounded-xl p-6 shadow-lg max-w-sm w-full mx-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-medium text-foreground mb-2">确认删除</h3>
            <p className="text-xs text-muted-foreground mb-4">
              删除项目后将同时删除该项目下的所有列和任务，此操作不可恢复。
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setDeleteTarget(null)}
                className="h-7 px-3 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleDeleteProject}
                disabled={isDeleting}
                className="h-7 px-3 text-xs font-medium bg-red-500 text-white rounded-md hover:bg-red-600 disabled:opacity-50 transition-colors"
              >
                {isDeleting ? '删除中...' : '确认删除'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
