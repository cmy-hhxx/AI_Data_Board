export type Priority = 'low' | 'medium' | 'high' | 'urgent'
export type UserRole = 'supervisor' | 'pm' | 'algorithm' | 'annotator' | 'crawler' | 'intern'

export interface User {
  id: string
  name: string
  role: UserRole
}

export interface Task {
  id: string
  projectId: string
  columnId: string | null
  title: string
  priority: Priority
  position: number
  assignee: string | null
  startDate: string | null
  endDate: string | null
  blocker: string | null
  columnEnteredAt: string | null
  estimatedHours: number | null
  createdAt: string
  updatedAt: string
  tags?: Tag[]
}

export interface TaskWithRelations extends Task {
  tags: Tag[]
}

export type CreateTaskInput = Pick<Task, 'projectId' | 'title'> & {
  columnId?: string
  priority?: Priority
  position?: number
  assignee?: string
  startDate?: string
  endDate?: string
  blocker?: string
  estimatedHours?: number
  tagIds?: string[]
}


export type UpdateTaskInput = {
  columnId?: string | null
  title?: string
  priority?: Priority
  position?: number
  assignee?: string | null
  startDate?: string | null
  endDate?: string | null
  blocker?: string | null
  estimatedHours?: number | null
  tagIds?: string[]
}

export interface BatchUpdatePosition {
  id: string
  columnId: string
  position: number
}

export interface Tag {
  id: string
  name: string
  color: string | null
}

export type CreateTagInput = { name: string; color?: string | null }

export interface KnowledgeBase {
  id: string
  name: string
  position: number
  createdAt: string
  updatedAt: string
}

export interface Document {
  id: string
  knowledgeBaseId: string
  name: string
  url: string | null
  content: string | null
  position: number
  createdAt: string
  updatedAt: string
}

export type CreateDocumentInput = { knowledgeBaseId: string; name: string; url?: string; content?: string }
