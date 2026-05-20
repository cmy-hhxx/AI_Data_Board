import { createContext, useContext, useReducer, type Dispatch, type ReactNode } from 'react'
import type { Project, BoardColumn, Task } from '@ai-data-board/shared'

export type ViewMode = 'tasks' | 'documents' | 'archived'

export interface BoardState {
  projects: Project[]
  currentProjectId: string | null
  columns: BoardColumn[]
  tasks: Task[]
  view: ViewMode
  loading: boolean
  taskSyncLocks: number
}

type TaskListSource = 'local' | 'remote' | 'force'

export type BoardAction =
  | { type: 'SET_PROJECTS'; payload: Project[] }
  | { type: 'ADD_PROJECT'; payload: Project }
  | { type: 'UPDATE_PROJECT'; payload: Project }
  | { type: 'REMOVE_PROJECT'; payload: string }
  | { type: 'SET_CURRENT_PROJECT'; payload: string | null }
  | { type: 'SET_COLUMNS'; payload: BoardColumn[] }
  | { type: 'ADD_COLUMN'; payload: BoardColumn }
  | { type: 'REMOVE_COLUMN'; payload: string }
  | { type: 'SET_TASKS'; payload: Task[]; source?: TaskListSource }
  | { type: 'ADD_TASK'; payload: Task }
  | { type: 'UPDATE_TASK'; payload: Task }
  | { type: 'REMOVE_TASK'; payload: string }
  | { type: 'REORDER_TASKS'; payload: { taskId: string; columnId: string; position: number } }
  | { type: 'BEGIN_TASK_SYNC' }
  | { type: 'END_TASK_SYNC' }
  | { type: 'SET_VIEW'; payload: ViewMode }
  | { type: 'SET_LOADING'; payload: boolean }

const initialState: BoardState = {
  projects: [],
  currentProjectId: null,
  columns: [],
  tasks: [],
  view: 'tasks',
  loading: false,
  taskSyncLocks: 0,
}

export function boardReducer(state: BoardState, action: BoardAction): BoardState {
  switch (action.type) {
    case 'SET_PROJECTS':
      return { ...state, projects: action.payload }
    case 'ADD_PROJECT': {
      const p = action.payload
      return { ...state, projects: [...state.projects, { ...p, taskCount: p.taskCount ?? 0, members: p.members ?? [] }] }
    }
    case 'UPDATE_PROJECT':
      return { ...state, projects: state.projects.map(p => p.id === action.payload.id ? { ...p, ...action.payload } : p) }
    case 'REMOVE_PROJECT':
      return { ...state, projects: state.projects.filter(p => p.id !== action.payload), currentProjectId: state.currentProjectId === action.payload ? null : state.currentProjectId }
    case 'SET_CURRENT_PROJECT':
      return { ...state, currentProjectId: action.payload, columns: action.payload ? state.columns : [], tasks: action.payload ? state.tasks : [], taskSyncLocks: 0 }
    case 'SET_COLUMNS':
      return { ...state, columns: action.payload }
    case 'ADD_COLUMN':
      return { ...state, columns: [...state.columns, action.payload] }
    case 'REMOVE_COLUMN':
      return { ...state, columns: state.columns.filter(c => c.id !== action.payload), tasks: state.tasks.filter(t => t.columnId !== action.payload) }
    case 'SET_TASKS':
      if (action.source === 'remote' && state.taskSyncLocks > 0) return state
      return { ...state, tasks: action.payload }
    case 'ADD_TASK':
      return { ...state, tasks: [...state.tasks, action.payload] }
    case 'UPDATE_TASK':
      return { ...state, tasks: state.tasks.map(t => t.id === action.payload.id ? action.payload : t) }
    case 'REMOVE_TASK':
      return { ...state, tasks: state.tasks.filter(t => t.id !== action.payload) }
    case 'REORDER_TASKS':
      return { ...state, tasks: state.tasks.map(t => t.id === action.payload.taskId ? { ...t, columnId: action.payload.columnId, position: action.payload.position } : t) }
    case 'BEGIN_TASK_SYNC':
      return { ...state, taskSyncLocks: state.taskSyncLocks + 1 }
    case 'END_TASK_SYNC':
      return { ...state, taskSyncLocks: Math.max(0, state.taskSyncLocks - 1) }
    case 'SET_VIEW':
      if (state.view === action.payload) return state
      return { ...state, view: action.payload }
    case 'SET_LOADING':
      return { ...state, loading: action.payload }
    default:
      return state
  }
}

const BoardContext = createContext<{ state: BoardState; dispatch: Dispatch<BoardAction> } | null>(null)

export function BoardProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(boardReducer, initialState)
  return <BoardContext.Provider value={{ state, dispatch }}>{children}</BoardContext.Provider>
}

export function useBoard() {
  const ctx = useContext(BoardContext)
  if (!ctx) throw new Error('useBoard must be used within BoardProvider')
  return ctx
}
