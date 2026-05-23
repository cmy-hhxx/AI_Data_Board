export type Priority = 'low' | 'medium' | 'high' | 'urgent'
export type UserRole = 'supervisor' | 'pm' | 'algorithm' | 'annotator' | 'crawler' | 'intern'

export interface User {
  id: string
  name: string
  role: UserRole
}

export type CreateUserInput = { name: string; role: UserRole }
export type UpdateUserInput = { name?: string; role?: UserRole }

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
  estimatedDays: number | null
  createdAt: string
  updatedAt: string
}

export type CreateTaskInput = Pick<Task, 'projectId' | 'title'> & {
  columnId?: string
  priority?: Priority
  position?: number
  assignee?: string
  startDate?: string
  endDate?: string
  blocker?: string
  estimatedDays?: number
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
  estimatedDays?: number | null
}

export interface ProgressNote {
  id: string
  taskId: string
  content: string
  createdAt: string
}

export type CreateProgressNoteInput = { content: string }

export interface BatchUpdatePosition {
  id: string
  columnId: string
  position: number
}

export interface Document {
  id: string
  projectId: string
  name: string
  url: string | null
  content: string | null
  position: number
  createdAt: string
  updatedAt: string
}

export type CreateDocumentInput = { name: string; url?: string; content?: string }

export interface CumulativeFlowPoint {
  date: string
  columnName: string
  count: number
}

export interface CumulativeFlowResponse {
  columns: string[]
  series: CumulativeFlowPoint[]
}
