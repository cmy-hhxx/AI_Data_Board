import type { Project, CreateProjectInput, UpdateProjectInput } from '@ai-data-board/shared'
import type { BoardColumn, CreateBoardColumnInput, UpdateBoardColumnInput } from '@ai-data-board/shared'
import type { Task, CreateTaskInput, UpdateTaskInput, BatchUpdatePosition } from '@ai-data-board/shared'
import type { Tag, CreateTagInput } from '@ai-data-board/shared'
import type { Attachment, CreateAttachmentInput, DocumentScope } from '@ai-data-board/shared'

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
    create: (data: CreateProjectInput) => request<Project>('/projects', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: UpdateProjectInput) => request<Project>(`/projects/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
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
  tags: {
    list: () => request<Tag[]>('/tags'),
    create: (data: CreateTagInput) => request<Tag>('/tags', { method: 'POST', body: JSON.stringify(data) }),
    delete: (id: string) => request<{ success: boolean }>(`/tags/${id}`, { method: 'DELETE' }),
  },
  attachments: {
    list: (params?: { projectId?: string; taskId?: string; scope?: DocumentScope }) => {
      const q = new URLSearchParams()
      if (params?.scope) q.set('scope', params.scope)
      if (params?.projectId) q.set('projectId', params.projectId)
      if (params?.taskId) q.set('taskId', params.taskId)
      return request<Attachment[]>(`/attachments${q.toString() ? `?${q}` : ''}`)
    },
    create: (data: CreateAttachmentInput) => request<Attachment>('/attachments', { method: 'POST', body: JSON.stringify(data) }),
    delete: (id: string) => request<{ success: boolean }>(`/attachments/${id}`, { method: 'DELETE' }),
  },
}
