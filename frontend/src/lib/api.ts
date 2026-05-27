import type { Project, CreateProjectInput, UpdateProjectInput } from '@ai-data-board/shared'
import type { BoardColumn, CreateBoardColumnInput, UpdateBoardColumnInput } from '@ai-data-board/shared'
import type { Task, CreateTaskInput, UpdateTaskInput, BatchUpdatePosition } from '@ai-data-board/shared'
import type { CumulativeFlowResponse } from '@ai-data-board/shared'
import type { Document, CreateDocumentInput } from '@ai-data-board/shared'
import type { ProgressNote, CreateProgressNoteInput } from '@ai-data-board/shared'

const BASE = '/api'

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${url}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  })
  if (!res.ok) throw new Error(`API error: ${res.status}`)
  return res.json()
}

// Projects
export const api = {
  projects: {
    list: () => request<Project[]>('/projects'),
    listArchived: () => request<Project[]>('/projects?includeArchived=true'),
    create: (data: CreateProjectInput) => request<Project>('/projects', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: UpdateProjectInput) => request<Project>(`/projects/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    archive: (id: string) => request<Project>(`/projects/${id}/archive`, { method: 'PATCH' }),
    restore: (id: string) => request<Project>(`/projects/${id}/restore`, { method: 'PATCH' }),
    delete: (id: string) => request<{ success: boolean }>(`/projects/${id}`, { method: 'DELETE' }),
  },
  columns: {
    list: (projectId: string) => request<BoardColumn[]>(`/projects/${projectId}/columns`),
    create: (projectId: string, data: CreateBoardColumnInput) => request<BoardColumn>(`/projects/${projectId}/columns`, { method: 'POST', body: JSON.stringify(data) }),
    update: (projectId: string, id: string, data: UpdateBoardColumnInput) => request<BoardColumn>(`/projects/${projectId}/columns/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (projectId: string, id: string) => request<{ success: boolean }>(`/projects/${projectId}/columns/${id}`, { method: 'DELETE' }),
  },
  tasks: {
    list: (projectId: string) => request<Task[]>(`/projects/${projectId}/tasks`),
    create: (projectId: string, data: CreateTaskInput) => request<Task>(`/projects/${projectId}/tasks`, { method: 'POST', body: JSON.stringify(data) }),
    update: (projectId: string, id: string, data: UpdateTaskInput) => request<Task>(`/projects/${projectId}/tasks/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (projectId: string, id: string) => request<{ success: boolean }>(`/projects/${projectId}/tasks/${id}`, { method: 'DELETE' }),
    reorder: (projectId: string, updates: BatchUpdatePosition[]) => request<{ success: boolean }>(`/projects/${projectId}/tasks/reorder`, { method: 'PATCH', body: JSON.stringify({ updates }) }),
  },
  progressNotes: {
    list: (projectId: string, taskId: string) =>
      request<ProgressNote[]>(`/projects/${projectId}/tasks/${taskId}/progress-notes`),
    create: (projectId: string, taskId: string, data: CreateProgressNoteInput) =>
      request<ProgressNote>(`/projects/${projectId}/tasks/${taskId}/progress-notes`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    delete: (projectId: string, taskId: string, noteId: string) =>
      request<{ success: boolean }>(`/projects/${projectId}/tasks/${taskId}/progress-notes/${noteId}`, {
        method: 'DELETE',
      }),
  },
  timeline: {
    get: () => request<{
      people: Array<{
        id: string
        name: string
        projects: Array<{
          id: string
          name: string
          color: string | null
          tasks: Array<{
            id: string
            title: string
            priority: 'low' | 'medium' | 'high' | 'urgent'
            columnName: string
            startDate: string | null
            endDate: string | null
          }>
        }>
      }>
    }>('/timeline'),
    getCumulativeFlow: (days?: number, personId?: string) => {
      const params = new URLSearchParams()
      if (days !== undefined) params.set('days', String(days))
      if (personId) params.set('personId', personId)
      return request<CumulativeFlowResponse>(`/timeline/cumulative-flow?${params}`)
    },
  },
  documents: {
    list: (projectId: string) => request<Document[]>(`/projects/${projectId}/documents`),
    create: (projectId: string, data: CreateDocumentInput) =>
      request<Document>(`/projects/${projectId}/documents`, { method: 'POST', body: JSON.stringify(data) }),
    delete: (projectId: string, id: string) =>
      request<{ success: boolean }>(`/projects/${projectId}/documents/${id}`, { method: 'DELETE' }),
    reorder: (projectId: string, updates: { id: string; position: number }[]) =>
      request<{ success: boolean }>(`/projects/${projectId}/documents/reorder`, { method: 'PATCH', body: JSON.stringify({ updates }) }),
  },
}
