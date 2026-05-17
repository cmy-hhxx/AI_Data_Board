import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { randomUUID } from 'crypto'
import type {
  Project,
  CreateProjectInput,
  UpdateProjectInput,
  BoardColumn,
  CreateBoardColumnInput,
  UpdateBoardColumnInput,
  Task,
  CreateTaskInput,
  UpdateTaskInput,
  CreateTagInput,
  Tag,
  KnowledgeBase,
  Document,
  CreateDocumentInput,
} from '@ai-data-board/shared'

interface LocalStoreData {
  projects: Project[]
  columns: BoardColumn[]
  tasks: Task[]
  tags: Tag[]
  taskTags: Record<string, string[]>
  knowledgeBases: KnowledgeBase[]
  documents: Document[]
}

type LocalCreateTaskInput = Omit<CreateTaskInput, 'projectId' | 'columnId' | 'assignee' | 'startDate' | 'endDate'> & {
  columnId?: string | null
  assignee?: string | null
  startDate?: string | null
  endDate?: string | null
}

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const dataDir = resolve(rootDir, '.data')
const dataFile = resolve(dataDir, 'local-store.json')

const defaultData: LocalStoreData = {
  projects: [],
  columns: [],
  tasks: [],
  tags: [],
  taskTags: {},
  knowledgeBases: [],
  documents: [],
}

function ensureDataDir() {
  mkdirSync(dataDir, { recursive: true })
}

function readData(): LocalStoreData {
  ensureDataDir()
  if (!existsSync(dataFile)) {
    return structuredClone(defaultData)
  }
  const raw = readFileSync(dataFile, 'utf8')
  const parsed = JSON.parse(raw) as Partial<LocalStoreData>
  return {
    projects: parsed.projects ?? [],
    columns: parsed.columns ?? [],
    tasks: parsed.tasks ?? [],
    tags: parsed.tags ?? [],
    taskTags: parsed.taskTags ?? {},
    knowledgeBases: parsed.knowledgeBases ?? [],
    documents: parsed.documents ?? [],
  }
}

function writeData(data: LocalStoreData) {
  ensureDataDir()
  writeFileSync(dataFile, JSON.stringify(data, null, 2) + '\n', 'utf8')
}

function withData<T>(updater: (data: LocalStoreData) => T): T {
  const data = readData()
  const result = updater(data)
  writeData(data)
  return result
}

function nowIso() {
  return new Date().toISOString()
}

function sortByPosition<T extends { position: number }>(items: T[]) {
  return [...items].sort((a, b) => a.position - b.position)
}

function normalizeNullable(value?: string | null) {
  return value ?? null
}

export const isLocalStoreEnabled = !process.env.DATABASE_URL

export const localStore = {
  listProjects() {
    return readData().projects.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  },

  createProject(input: CreateProjectInput) {
    return withData(data => {
      const now = nowIso()
      const row: Project = {
        id: randomUUID(),
        name: input.name,
        description: normalizeNullable(input.description),
        color: normalizeNullable(input.color),
        createdAt: now,
        updatedAt: now,
      }
      data.projects.push(row)
      return row
    })
  },

  updateProject(id: string, input: UpdateProjectInput) {
    return withData(data => {
      const row = data.projects.find(project => project.id === id)
      if (!row) return null
      if (input.name !== undefined) row.name = input.name
      if (input.description !== undefined) row.description = normalizeNullable(input.description)
      if (input.color !== undefined) row.color = normalizeNullable(input.color)
      row.updatedAt = nowIso()
      return row
    })
  },

  deleteProject(id: string) {
    return withData(data => {
      data.projects = data.projects.filter(project => project.id !== id)
      const columnIds = new Set(data.columns.filter(column => column.projectId === id).map(column => column.id))
      const taskIds = new Set(data.tasks.filter(task => task.projectId === id).map(task => task.id))
      data.columns = data.columns.filter(column => column.projectId !== id)
      data.tasks = data.tasks.filter(task => task.projectId !== id)
      for (const taskId of taskIds) delete data.taskTags[taskId]
      for (const task of data.tasks) {
        if (columnIds.has(task.columnId ?? '')) task.columnId = null
      }
    })
  },

  listColumns(projectId: string) {
    return sortByPosition(readData().columns.filter(column => column.projectId === projectId))
  },

  createColumn(projectId: string, input: CreateBoardColumnInput) {
    return withData(data => {
      const position = Math.max(-1, ...data.columns.filter(column => column.projectId === projectId).map(column => column.position)) + 1
      const row: BoardColumn = {
        id: randomUUID(),
        projectId,
        name: input.name,
        position,
        color: normalizeNullable(input.color),
        createdAt: nowIso(),
      }
      data.columns.push(row)
      return row
    })
  },

  updateColumn(projectId: string, id: string, input: UpdateBoardColumnInput) {
    return withData(data => {
      const row = data.columns.find(column => column.id === id && column.projectId === projectId)
      if (!row) return null
      if (input.name !== undefined) row.name = input.name
      if (input.position !== undefined) row.position = input.position
      if (input.color !== undefined) row.color = normalizeNullable(input.color)
      return row
    })
  },

  deleteColumn(projectId: string, id: string) {
    return withData(data => {
      data.columns = data.columns.filter(column => !(column.id === id && column.projectId === projectId))
      for (const task of data.tasks) {
        if (task.projectId === projectId && task.columnId === id) task.columnId = null
      }
    })
  },

  listTasks(projectId: string) {
    return sortByPosition(readData().tasks.filter(task => task.projectId === projectId))
  },

  createTask(projectId: string, input: LocalCreateTaskInput) {
    return withData(data => {
      const position = Math.max(
        -1,
        ...data.tasks
          .filter(task => task.projectId === projectId && task.columnId === (input.columnId ?? null))
          .map(task => task.position),
      ) + 1
      const now = nowIso()
      const row: Task = {
        id: randomUUID(),
        projectId,
        columnId: input.columnId ?? null,
        title: input.title,
        priority: input.priority ?? 'medium',
        position,
        assignee: normalizeNullable(input.assignee),
        startDate: normalizeNullable(input.startDate),
        endDate: normalizeNullable(input.endDate),
        createdAt: now,
        updatedAt: now,
      }
      data.tasks.push(row)
      if (input.tagIds !== undefined) {
        data.taskTags[row.id] = [...input.tagIds]
      }
      return row
    })
  },

  updateTask(projectId: string, id: string, input: UpdateTaskInput) {
    return withData(data => {
      const row = data.tasks.find(task => task.id === id && task.projectId === projectId)
      if (!row) return null
      if (input.columnId !== undefined) row.columnId = input.columnId
      if (input.title !== undefined) row.title = input.title
      if (input.priority !== undefined) row.priority = input.priority
      if (input.position !== undefined) row.position = input.position
      if (input.assignee !== undefined) row.assignee = normalizeNullable(input.assignee)
      if (input.startDate !== undefined) row.startDate = normalizeNullable(input.startDate)
      if (input.endDate !== undefined) row.endDate = normalizeNullable(input.endDate)
      if (input.tagIds !== undefined) data.taskTags[id] = [...input.tagIds]
      row.updatedAt = nowIso()
      return row
    })
  },

  deleteTask(projectId: string, id: string) {
    return withData(data => {
      data.tasks = data.tasks.filter(task => !(task.id === id && task.projectId === projectId))
      delete data.taskTags[id]
    })
  },

  reorderTasks(updates: Array<{ id: string; columnId: string; position: number }>) {
    return withData(data => {
      for (const update of updates) {
        const row = data.tasks.find(task => task.id === update.id)
        if (!row) continue
        row.columnId = update.columnId
        row.position = update.position
        row.updatedAt = nowIso()
      }
    })
  },

  listTags() {
    return [...readData().tags].sort((a, b) => a.name.localeCompare(b.name))
  },

  createTag(input: CreateTagInput) {
    return withData(data => {
      const row: Tag = {
        id: randomUUID(),
        name: input.name,
        color: normalizeNullable(input.color),
      }
      data.tags.push(row)
      return row
    })
  },

  updateTag(id: string, input: Partial<CreateTagInput>) {
    return withData(data => {
      const row = data.tags.find(tag => tag.id === id)
      if (!row) return null
      if (input.name !== undefined) row.name = input.name
      if (input.color !== undefined) row.color = normalizeNullable(input.color)
      return row
    })
  },

  deleteTag(id: string) {
    return withData(data => {
      data.tags = data.tags.filter(tag => tag.id !== id)
      for (const taskId of Object.keys(data.taskTags)) {
        data.taskTags[taskId] = data.taskTags[taskId].filter(tagId => tagId !== id)
      }
    })
  },

  listKnowledgeBases() {
    return sortByPosition(readData().knowledgeBases)
  },

  createKnowledgeBase(name: string) {
    return withData(data => {
      const now = nowIso()
      const position = Math.max(-1, ...data.knowledgeBases.map(kb => kb.position)) + 1
      const row: KnowledgeBase = {
        id: randomUUID(),
        name,
        position,
        createdAt: now,
        updatedAt: now,
      }
      data.knowledgeBases.push(row)
      return row
    })
  },

  deleteKnowledgeBase(id: string) {
    return withData(data => {
      data.knowledgeBases = data.knowledgeBases.filter(kb => kb.id !== id)
      data.documents = data.documents.filter(document => document.knowledgeBaseId !== id)
    })
  },

  reorderKnowledgeBases(updates: Array<{ id: string; position: number }>) {
    return withData(data => {
      for (const update of updates) {
        const row = data.knowledgeBases.find(kb => kb.id === update.id)
        if (!row) continue
        row.position = update.position
        row.updatedAt = nowIso()
      }
    })
  },

  listDocuments(kbId: string) {
    return sortByPosition(readData().documents.filter(document => document.knowledgeBaseId === kbId))
  },

  createDocument(kbId: string, input: Omit<CreateDocumentInput, 'knowledgeBaseId'>) {
    return withData(data => {
      const now = nowIso()
      const position = Math.max(-1, ...data.documents.filter(document => document.knowledgeBaseId === kbId).map(document => document.position)) + 1
      const row: Document = {
        id: randomUUID(),
        knowledgeBaseId: kbId,
        name: input.name,
        url: normalizeNullable(input.url),
        content: normalizeNullable(input.content),
        position,
        createdAt: now,
        updatedAt: now,
      }
      data.documents.push(row)
      return row
    })
  },

  deleteDocument(id: string) {
    return withData(data => {
      data.documents = data.documents.filter(document => document.id !== id)
    })
  },

  reorderDocuments(updates: Array<{ id: string; position: number }>) {
    return withData(data => {
      for (const update of updates) {
        const row = data.documents.find(document => document.id === update.id)
        if (!row) continue
        row.position = update.position
        row.updatedAt = nowIso()
      }
    })
  },
}
