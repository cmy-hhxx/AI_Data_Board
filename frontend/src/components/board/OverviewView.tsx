import { useEffect, useState } from 'react'
import { useBoard } from '../../contexts/BoardContext'
import { api } from '../../lib/api'
import { Trash2, Archive } from 'lucide-react'
import { ProjectPool } from './ProjectPool'
import { PersonnelOverview } from './PersonnelOverview'
import { CumulativeFlowDiagram } from './CumulativeFlowDiagram'

export function OverviewView() {
  const { state, dispatch } = useBoard()
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [archiveTarget, setArchiveTarget] = useState<string | null>(null)
  const [isArchiving, setIsArchiving] = useState(false)
  const [archivedCount, setArchivedCount] = useState(0)
  const [selectedPersonId, setSelectedPersonId] = useState<string | undefined>()

  useEffect(() => {
    api.projects.listArchived().then(projects => setArchivedCount(projects.length)).catch(() => { })
  }, [state.projects.length])

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

  const deleteTargetProject = state.projects.find(p => p.id === deleteTarget)
  const archiveTargetProject = state.projects.find(p => p.id === archiveTarget)

  return (
    <div className="min-h-full px-6 py-6 max-w-[1600px] mx-auto flex flex-col" style={{ height: 'calc(100vh - var(--navbar-height))' }}>
      {/* ===== TOP SECTION: ProjectPool + PersonnelOverview ===== */}
      <div className="flex gap-6 flex-[3] min-h-0" style={{ minHeight: 300 }}>
        {/* Left: Project Pool */}
        <div className="flex-[3] min-w-0">
          <ProjectPool
            projects={state.projects}
            archivedCount={archivedCount}
            onSelectProject={(id) => dispatch({ type: 'SET_CURRENT_PROJECT', payload: id })}
            onArchiveProject={(id) => setArchiveTarget(id)}
            onDeleteProject={(id) => setDeleteTarget(id)}
          />
        </div>

        {/* Right: Personnel Overview */}
        <div className="flex-[2] min-w-0 h-full flex flex-col">
          <h2 className="text-sm font-semibold text-foreground mb-3 shrink-0">人员工作总览</h2>
          <div className="border border-border/40 rounded-lg p-3 flex-1 min-h-0 overflow-y-auto">
            <PersonnelOverview
              selectedPersonId={selectedPersonId}
              onPersonSelect={setSelectedPersonId}
            />
          </div>
        </div>
      </div>

      {/* ===== BOTTOM SECTION: Cumulative Flow Diagram ===== */}
      <div className="mt-6 flex-[2] min-h-0" style={{ minHeight: 340 }}>
        <CumulativeFlowDiagram highlightPersonId={selectedPersonId} />
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
