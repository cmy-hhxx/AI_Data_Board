export type Priority = 'low' | 'medium' | 'high' | 'urgent'

export interface Task {
  id: string
  projectId: string
  columnId: string | null
  title: string
  description: string | null
  priority: Priority
  position: number
  assignee: string | null
  dueDate: string | null
  startDate: string | null
  endDate: string | null
  createdAt: string
  updatedAt: string
  tags?: Tag[]
  attachments?: Attachment[]
}

export interface TaskWithRelations extends Task {
  tags: Tag[]
  attachments: Attachment[]
}

export type CreateTaskInput = Pick<Task, 'projectId' | 'title'> & {
  columnId?: string
  description?: string
  priority?: Priority
  position?: number
  assignee?: string
  dueDate?: string
  startDate?: string
  endDate?: string
  tagIds?: string[]
}

export type UpdateTaskInput = {
  columnId?: string | null
  title?: string
  description?: string | null
  priority?: Priority
  position?: number
  assignee?: string | null
  dueDate?: string | null
  startDate?: string | null
  endDate?: string | null
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

export type AttachmentType = 'file' | 'link' | 'image' | 'code'

export interface Attachment {
  id: string
  taskId: string
  name: string
  type: AttachmentType
  url: string | null
  content: string | null
  size: number | null
  createdAt: string
}

export type CreateAttachmentInput = Pick<Attachment, 'taskId' | 'name' | 'type' | 'url' | 'content' | 'size'>
