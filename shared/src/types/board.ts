export interface BoardColumn {
  id: string
  projectId: string
  name: string
  position: number
  color: string | null
  createdAt: string
}

export type CreateBoardColumnInput = { projectId?: string; name: string; color?: string | null; position?: number }
export type UpdateBoardColumnInput = Partial<Pick<BoardColumn, 'name' | 'position' | 'color'>>

export type BoardSubView = 'board' | 'progress'
