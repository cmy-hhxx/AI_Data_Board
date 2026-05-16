import { createContext, useContext, useReducer, type Dispatch, type ReactNode } from 'react'
import type { Project, BoardColumn, Task, Tag } from '@ai-data-board/shared'

interface BoardState {
  projects: Project[]
  currentProjectId: string | null
  columns: BoardColumn[]
  tasks: Task[]
  tags: Tag[]
  loading: boolean
}

type BoardAction =
  | { type: 'SET_PROJECTS'; payload: Project[] }
  | { type: 'ADD_PROJECT'; payload: Project }
  | { type: 'UPDATE_PROJECT'; payload: Project }
  | { type: 'REMOVE_PROJECT'; payload: string }
  | { type: 'SET_CURRENT_PROJECT'; payload: string }
  | { type: 'SET_COLUMNS'; payload: BoardColumn[] }
  | { type: 'ADD_COLUMN'; payload: BoardColumn }
  | { type: 'REMOVE_COLUMN'; payload: string }
  | { type: 'SET_TASKS'; payload: Task[] }
  | { type: 'ADD_TASK'; payload: Task }
  | { type: 'UPDATE_TASK'; payload: Task }
  | { type: 'REMOVE_TASK'; payload: string }
  | { type: 'REORDER_TASKS'; payload: { taskId: string; columnId: string; position: number } }
  | { type: 'SET_TAGS'; payload: Tag[] }
  | { type: 'ADD_TAG'; payload: Tag }
  | { type: 'REMOVE_TAG'; payload: string }
  | { type: 'SET_LOADING'; payload: boolean }

const initialState: BoardState = {
  projects: [],
  currentProjectId: null,
  columns: [],
  tasks: [],
  tags: [],
  loading: false,
}

function boardReducer(state: BoardState, action: BoardAction): BoardState {
  switch (action.type) {
    case 'SET_PROJECTS':
      return { ...state, projects: action.payload }
    case 'ADD_PROJECT':
      return { ...state, projects: [...state.projects, action.payload] }
    case 'UPDATE_PROJECT':
      return { ...state, projects: state.projects.map(p => p.id === action.payload.id ? action.payload : p) }
    case 'REMOVE_PROJECT':
      return { ...state, projects: state.projects.filter(p => p.id !== action.payload), currentProjectId: state.currentProjectId === action.payload ? null : state.currentProjectId }
    case 'SET_CURRENT_PROJECT':
      return { ...state, currentProjectId: action.payload }
    case 'SET_COLUMNS':
      return { ...state, columns: action.payload }
    case 'ADD_COLUMN':
      return { ...state, columns: [...state.columns, action.payload] }
    case 'REMOVE_COLUMN':
      return { ...state, columns: state.columns.filter(c => c.id !== action.payload), tasks: state.tasks.filter(t => t.columnId !== action.payload) }
    case 'SET_TASKS':
      return { ...state, tasks: action.payload }
    case 'ADD_TASK':
      return { ...state, tasks: [...state.tasks, action.payload] }
    case 'UPDATE_TASK':
      return { ...state, tasks: state.tasks.map(t => t.id === action.payload.id ? action.payload : t) }
    case 'REMOVE_TASK':
      return { ...state, tasks: state.tasks.filter(t => t.id !== action.payload) }
    case 'REORDER_TASKS':
      return { ...state, tasks: state.tasks.map(t => t.id === action.payload.taskId ? { ...t, columnId: action.payload.columnId, position: action.payload.position } : t) }
    case 'SET_TAGS':
      return { ...state, tags: action.payload }
    case 'ADD_TAG':
      return { ...state, tags: [...state.tags, action.payload] }
    case 'REMOVE_TAG':
      return { ...state, tags: state.tags.filter(t => t.id !== action.payload) }
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
