export interface Project {
  id: string
  name: string
  description: string | null
  color: string | null
  createdAt: string
  updatedAt: string
  archivedAt: string | null
  taskCount: number
  members: { id: string; name: string }[]
}

export type CreateProjectInput = { name: string; description?: string | null; color?: string | null }
export type UpdateProjectInput = Partial<CreateProjectInput>
