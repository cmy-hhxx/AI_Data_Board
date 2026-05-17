import { useState, useEffect } from 'react'
import { useBoard } from '../../contexts/BoardContext'
import { api } from '../../lib/api'
import type { Attachment, AttachmentType } from '@ai-data-board/shared'
import { FileText, Code, Link, Image, ChevronRight, Plus, X } from 'lucide-react'
import { cn } from '../../lib/utils'

const typeIcons: Record<AttachmentType, React.ReactNode> = {
  file: <FileText className="w-3.5 h-3.5" />,
  code: <Code className="w-3.5 h-3.5" />,
  link: <Link className="w-3.5 h-3.5" />,
  image: <Image className="w-3.5 h-3.5" />,
}

const typeLabels: Record<AttachmentType, string> = {
  file: '文件',
  code: '代码',
  link: '链接',
  image: '图片',
}

export function DocumentView() {
  const { state } = useBoard()
  const [docs, setDocs] = useState<Attachment[]>([])
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [showUpload, setShowUpload] = useState<{ projectId: string; taskId?: string } | null>(null)
  const [uploadName, setUploadName] = useState('')
  const [uploadType, setUploadType] = useState<'file' | 'code' | 'link' | 'image'>('file')
  const [previewDoc, setPreviewDoc] = useState<Attachment | null>(null)

  useEffect(() => {
    if (!state.currentProjectId) { setDocs([]); return }
    api.attachments.list({ projectId: state.currentProjectId }).then(setDocs)
  }, [state.currentProjectId])

  const projectDocs = docs.filter(d => !d.taskId)
  const tasksWithDocs = state.tasks.map(t => ({
    task: t,
    docs: docs.filter(d => d.taskId === t.id),
  })).filter(({ docs }) => docs.length > 0)

  const toggleExpand = (id: string) => {
    const next = new Set(expanded)
    next.has(id) ? next.delete(id) : next.add(id)
    setExpanded(next)
  }

  const handleUpload = async () => {
    if (!uploadName.trim() || !showUpload) return
    const row = await api.attachments.create({
      projectId: showUpload.projectId,
      taskId: showUpload.taskId,
      name: uploadName.trim(),
      type: uploadType,
    })
    setUploadName('')
    setShowUpload(null)
    setDocs(prev => [...prev, row])
  }

  if (!state.currentProjectId) {
    return (
      <div className="flex items-center justify-center" style={{ height: 'calc(100vh - 120px)' }}>
        <p className="text-sm text-muted-foreground/60">选择一个项目查看文档</p>
      </div>
    )
  }

  const totalDocs = docs.length

  return (
    <div className="px-6 pt-2 pb-6" style={{ height: 'calc(100vh - 72px)' }}>
      <div className="max-w-3xl mx-auto pt-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold">文档 ({totalDocs})</h2>
          <button
            onClick={() => setShowUpload({ projectId: state.currentProjectId! })}
            className="flex items-center gap-1.5 h-8 px-4 text-xs font-medium bg-foreground text-background rounded-lg hover:opacity-90"
          >
            <Plus className="w-3.5 h-3.5" /> 上传文档
          </button>
        </div>

        {projectDocs.length > 0 && (
          <div className="mb-8">
            <h3 className="text-xs font-semibold text-muted-foreground tracking-wide uppercase mb-3">项目文档</h3>
            <div className="space-y-1">
              {projectDocs.map((doc) => (
                <DocRow key={doc.id} doc={doc} onPreview={setPreviewDoc} />
              ))}
            </div>
          </div>
        )}

        {tasksWithDocs.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold text-muted-foreground tracking-wide uppercase mb-3">任务文档</h3>
            <div className="space-y-2">
              {tasksWithDocs.map(({ task, docs: taskDocs }) => (
                <div key={task.id}>
                  <button
                    onClick={() => toggleExpand(task.id)}
                    className="flex items-center gap-2 w-full px-3 h-9 rounded-lg hover:bg-accent text-left"
                  >
                    <ChevronRight className={cn('w-3.5 h-3.5 text-muted-foreground transition-transform', expanded.has(task.id) && 'rotate-90')} />
                    <span className="text-sm font-medium truncate flex-1">{task.title}</span>
                    <span className="text-[11px] text-muted-foreground tabular-nums">{taskDocs.length}</span>
                  </button>
                  {expanded.has(task.id) && (
                    <div className="ml-6 mt-1 space-y-1">
                      {taskDocs.map((doc) => (
                        <DocRow key={doc.id} doc={doc} onPreview={setPreviewDoc} />
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {totalDocs === 0 && (
          <div className="text-center py-16 text-sm text-muted-foreground/60 border-2 border-dashed border-border/40 rounded-xl">
            暂无文档。点击「上传文档」添加。
          </div>
        )}
      </div>

      {/* Upload dialog */}
      {showUpload && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh] bg-black/20 backdrop-blur-sm" onClick={() => setShowUpload(null)}>
          <div className="bg-card border border-border/80 rounded-2xl shadow-2xl w-full max-w-sm mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 pt-4 pb-2">
              <h3 className="text-sm font-semibold">上传文档</h3>
              <button onClick={() => setShowUpload(null)} className="p-1 rounded-lg hover:bg-accent">
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
            <div className="px-5 pb-4 space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">名称</label>
                <input
                  autoFocus
                  value={uploadName}
                  onChange={(e) => setUploadName(e.target.value)}
                  placeholder="文档名称"
                  className="w-full h-9 px-3 text-sm border border-border/70 rounded-lg bg-background outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">类型</label>
                <select
                  value={uploadType}
                  onChange={(e) => setUploadType(e.target.value as AttachmentType)}
                  className="w-full h-9 px-3 text-sm border border-border/70 rounded-lg bg-background outline-none"
                >
                  <option value="file">文件</option>
                  <option value="code">代码</option>
                  <option value="link">链接</option>
                  <option value="image">图片</option>
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button onClick={() => setShowUpload(null)} className="h-8 px-4 text-xs text-muted-foreground hover:text-foreground">取消</button>
                <button onClick={handleUpload} className="h-8 px-5 text-xs font-medium bg-foreground text-background rounded-lg hover:opacity-90">保存</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Preview dialog */}
      {previewDoc && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] bg-black/20 backdrop-blur-sm" onClick={() => setPreviewDoc(null)}>
          <div className="bg-card border border-border/80 rounded-2xl shadow-2xl w-full max-w-lg mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 pt-5 pb-3">
              <div>
                <h3 className="text-sm font-semibold">{previewDoc.name}</h3>
                <span className="text-xs text-muted-foreground">{typeLabels[previewDoc.type]}</span>
              </div>
              <button onClick={() => setPreviewDoc(null)} className="p-1.5 rounded-lg hover:bg-accent">
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
            <div className="px-6 pb-6">
              {previewDoc.type === 'link' && previewDoc.url ? (
                <a href={previewDoc.url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-foreground underline break-all">
                  {previewDoc.url}
                </a>
              ) : (
                <pre className="bg-foreground text-background rounded-xl p-4 text-sm leading-relaxed overflow-auto max-h-[400px] whitespace-pre-wrap">
                  {previewDoc.content || previewDoc.url || '(无内容)'}
                </pre>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function DocRow({ doc, onPreview }: { doc: Attachment; onPreview: (d: Attachment) => void }) {
  return (
    <button
      onClick={() => onPreview(doc)}
      className="flex items-center gap-3 w-full px-3 h-9 rounded-lg hover:bg-accent text-left"
    >
      <span className="text-muted-foreground">{typeIcons[doc.type] || typeIcons.file}</span>
      <span className="text-sm truncate flex-1">{doc.name}</span>
      <span className="text-[11px] text-muted-foreground">{typeLabels[doc.type]}</span>
    </button>
  )
}
