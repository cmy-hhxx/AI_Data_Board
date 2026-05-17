import { Hono } from 'hono'
import { db } from '../db'
import { tasks, projects, boardColumns, users } from '../db/schema'
import { isNotNull, eq } from 'drizzle-orm'
import { logger, type Priority } from '@ai-data-board/shared'

const TAG = 'Timeline'

interface TimelineResponse {
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
        priority: Priority
        columnName: string
        startDate: string | null
        endDate: string | null
      }>
    }>
  }>
}

export const timelineRouter = new Hono()

timelineRouter.get('/timeline', async (c) => {
  const rows = await db
    .select()
    .from(tasks)
    .leftJoin(users, eq(tasks.assignee, users.id))
    .leftJoin(projects, eq(tasks.projectId, projects.id))
    .leftJoin(boardColumns, eq(tasks.columnId, boardColumns.id))
    .where(isNotNull(tasks.assignee))

  logger.debug(TAG, `查询到 ${rows.length} 条有分配者的任务`)

  if (rows.length === 0) {
    return c.json({ people: [] })
  }

  const peopleMap = new Map<string, {
    id: string
    name: string
    projects: Map<string, {
      id: string
      name: string
      color: string | null
      tasks: Array<{
        id: string
        title: string
        priority: Priority
        columnName: string
        startDate: string | null
        endDate: string | null
      }>
    }>
  }>()

  for (const row of rows) {
    const user = row.users
    const task = row.tasks
    const project = row.projects
    const column = row.board_columns

    if (!user) continue

    if (!peopleMap.has(user.id)) {
      peopleMap.set(user.id, {
        id: user.id,
        name: user.name,
        projects: new Map(),
      })
    }

    const person = peopleMap.get(user.id)!

    if (project) {
      if (!person.projects.has(project.id)) {
        person.projects.set(project.id, {
          id: project.id,
          name: project.name,
          color: project.color,
          tasks: [],
        })
      }

      person.projects.get(project.id)!.tasks.push({
        id: task.id,
        title: task.title,
        priority: task.priority as Priority,
        columnName: column?.name ?? '未分类',
        startDate: task.startDate,
        endDate: task.endDate,
      })
    }
  }

  const people = Array.from(peopleMap.values()).map((p) => ({
    id: p.id,
    name: p.name,
    projects: Array.from(p.projects.values()),
  }))

  return c.json({ people })
})
