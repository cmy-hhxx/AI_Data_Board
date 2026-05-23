import { useState, useEffect, useCallback } from 'react'
import { api } from '../../lib/api'
import { useBoard } from '../../contexts/BoardContext'
import type { Document } from '@ai-data-board/shared'
import { FileText, Plus, Trash2, ExternalLink, ChevronUp, ChevronDown } from 'lucide-react'
import { cn } from '../../lib/utils'

export function DocumentView() {
  const { state } = useBoard()
  const projects = state.projects.filter(p => !p.archivedAt)

  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [docs, setDocs] = useState<Document[]>([])
  const [showNewDoc, setShowNewDoc] = useState(false)
  const [newDocName, setNewDocName] = useState('')
  const [newDocUrl, setNewDocUrl] = useState('')

  const loadDocs = useCallback(async (projectId: string) => {
    const rows = await api.documents.list(projectId)
    setDocs(rows)
  }, [])

  // Auto-select first project on first render (or whenever the previous selection vanishes).
  useEffect(() => {
    if (selectedProjectId && projects.some(p => p.id === selectedProjectId)) return
    setSelectedProjectId(projects[0]?.id ?? null)
  }, [projects, selectedProjectId])

  useEffect(() => {
    if (selectedProjectId) {
      loadDocs(selectedProjectId)
    } else {
      setDocs([])
    }
    setShowNewDoc(false)
    setNewDocName('')
    setNewDocUrl('')
  }, [selectedProjectId, loadDocs])

  const handleCreateDoc = async () => {
    if (!newDocName.trim() || !selectedProjectId) return
    const doc = await api.documents.create(selectedProjectId, {
      name: newDocName.trim(),
      url: newDocUrl.trim() || undefined,
    })
    setDocs(prev => [...prev, doc])
    setNewDocName('')
    setNewDocUrl('')
    setShowNewDoc(false)
  }

  const handleDeleteDoc = async (id: string) => {
    if (!selectedProjectId) return
    await api.documents.delete(selectedProjectId, id)
    setDocs(prev => prev.filter(d => d.id !== id))
  }

  const handleMoveDoc = async (docId: string, direction: 'up' | 'down') => {
    if (!selectedProjectId) return
    const idx = docs.findIndex(d => d.id === docId)
    if (idx === -1) return
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1
    if (targetIdx < 0 || targetIdx >= docs.length) return

    const updated = [...docs]
    const [moved] = updated.splice(idx, 1)
    updated.splice(targetIdx, 0, moved)

    const reordered = updated.map((d, i) => ({ ...d, position: i }))
    setDocs(reordered)

    const updates = reordered.map(d => ({ id: d.id, position: d.position }))
    api.documents.reorder(selectedProjectId, updates).catch(() => loadDocs(selectedProjectId))
  }

  const selectedProject = projects.find(p => p.id === selectedProjectId)

  return (
    <div className="px-6 pt-2 pb-6" style={{ height: 'calc(100vh - 44px)' }}>
      <div className="flex gap-6 h-full max-w-5xl mx-auto pt-4">
        {/* Left: Projects (read-only mirror of the board) */}
        <div className="w-60 shrink-0 flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-semibold text-muted-foreground tracking-wide uppercase">项目</h2>
          </div>

          <div className="flex-1 overflow-y-auto space-y-0.5">
            {projects.map((project) => (
              <button
                key={project.id}
                onClick={() => setSelectedProjectId(project.id)}
                className={cn(
                  'flex items-center w-full px-2.5 h-8 rounded-lg text-left transition-colors',
                  selectedProjectId === project.id
                    ? 'bg-accent font-medium'
                    : 'hover:bg-accent/60 text-muted-foreground hover:text-foreground'
                )}
              >
                {project.color && (
                  <span
                    className="w-1.5 h-1.5 rounded-full shrink-0 mr-2"
                    style={{ backgroundColor: project.color }}
                  />
                )}
                <span className="text-xs truncate flex-1">{project.name}</span>
              </button>
            ))}
            {projects.length === 0 && (
              <p className="text-xs text-muted-foreground/60 px-2 py-4">
                请先在看板视图中创建项目
              </p>
            )}
          </div>
        </div>

        {/* Right: Documents */}
        <div className="flex-1 flex flex-col min-w-0">
          {selectedProject ? (
            <>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold truncate">{selectedProject.name}</h2>
                <button
                  onClick={() => setShowNewDoc(true)}
                  className="flex items-center gap-1 h-7 px-3 text-xs font-medium bg-foreground text-background rounded-lg hover:opacity-90 transition-opacity"
                >
                  <Plus className="w-3 h-3" /> 添加文档
                </button>
              </div>

              {showNewDoc && (
                <div className="space-y-2 mb-3 p-3 border border-border/60 rounded-xl bg-muted/30">
                  <input
                    autoFocus
                    value={newDocName}
                    onChange={(e) => setNewDocName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleCreateDoc(); if (e.key === 'Escape') setShowNewDoc(false) }}
                    placeholder="文档名称"
                    className="w-full h-8 px-2.5 text-xs border rounded bg-background outline-none"
                  />
                  <input
                    value={newDocUrl}
                    onChange={(e) => setNewDocUrl(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleCreateDoc(); if (e.key === 'Escape') setShowNewDoc(false) }}
                    placeholder="https://..."
                    className="w-full h-8 px-2.5 text-xs border rounded bg-background outline-none"
                  />
                  <div className="flex justify-end gap-1.5">
                    <button onClick={() => setShowNewDoc(false)} className="h-7 px-3 text-xs text-muted-foreground hover:text-foreground">取消</button>
                    <button onClick={handleCreateDoc} className="h-7 px-3 text-xs font-medium bg-foreground text-background rounded">添加</button>
                  </div>
                </div>
              )}

              <div className="flex-1 overflow-y-auto space-y-0.5">
                {docs.map((doc, idx) => (
                  <div
                    key={doc.id}
                    className="flex items-center gap-2 px-2.5 h-9 rounded-lg hover:bg-accent transition-colors group/doc"
                  >
                    <div className="flex items-center gap-0.5 opacity-0 group-hover/doc:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleMoveDoc(doc.id, 'up')}
                        disabled={idx === 0}
                        className="p-0.5 rounded hover:bg-accent-foreground/10 disabled:opacity-20"
                      >
                        <ChevronUp className="w-3 h-3 text-muted-foreground" />
                      </button>
                      <button
                        onClick={() => handleMoveDoc(doc.id, 'down')}
                        disabled={idx === docs.length - 1}
                        className="p-0.5 rounded hover:bg-accent-foreground/10 disabled:opacity-20"
                      >
                        <ChevronDown className="w-3 h-3 text-muted-foreground" />
                      </button>
                    </div>
                    <FileText className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <span className="text-xs truncate flex-1">{doc.name}</span>
                    {doc.url && (
                      <a
                        href={doc.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="shrink-0 opacity-0 group-hover/doc:opacity-100 transition-opacity p-0.5 rounded hover:bg-accent-foreground/10"
                      >
                        <ExternalLink className="w-3 h-3 text-muted-foreground" />
                      </a>
                    )}
                    <button
                      onClick={() => handleDeleteDoc(doc.id)}
                      className="shrink-0 p-0.5 rounded opacity-0 group-hover/doc:opacity-100 hover:bg-accent-foreground/10 transition-opacity"
                    >
                      <Trash2 className="w-3 h-3 text-muted-foreground/50 hover:text-destructive" />
                    </button>
                  </div>
                ))}
                {docs.length === 0 && !showNewDoc && (
                  <p className="text-xs text-muted-foreground/60 px-2 py-8 text-center">暂无文档，点击「添加文档」</p>
                )}
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-full text-sm text-muted-foreground/60">
              {projects.length === 0 ? '请先在看板视图中创建项目' : '选择左侧的项目'}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
