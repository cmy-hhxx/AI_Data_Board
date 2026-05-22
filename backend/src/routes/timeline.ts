import { Hono } from 'hono'
import { db } from '../db'
import { tasks, projects, boardColumns, users } from '../db/schema'
import { isNotNull, eq, sql, and } from 'drizzle-orm'
import { logger, type Priority } from '@ai-data-board/shared'
import type { CumulativeFlowResponse } from '@ai-data-board/shared'

const TAG = 'Timeline'

interface TimelineResponse {
  people: Array<{
    id: string
    name: string
    role: string
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
    role: string
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
        role: user.role,
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
    role: p.role,
    projects: Array.from(p.projects.values()),
  }))

  return c.json({ people })
})

timelineRouter.get('/timeline/cumulative-flow', async (c) => {
  const days = parseInt(c.req.query('days') || '30', 10)
  const personId = c.req.query('personId')

  const personFilter = personId
    ? sql`AND t.assignee = ${personId}::uuid`
    : sql``

  const rows = await db.execute<{
    date: string
    column_name: string
    count: string
  }>(sql`
    SELECT
      d.day::date AS date,
      bc.name AS column_name,
      COUNT(t.id)::int AS count
    FROM generate_series(
      current_date - ${days}::int,
      current_date,
      '1 day'::interval
    ) d(day)
    CROSS JOIN board_columns bc
    JOIN projects p ON bc.project_id = p.id AND p.archived_at IS NULL
    LEFT JOIN tasks t ON t.column_id = bc.id
      AND t.column_entered_at IS NOT NULL
      AND t.column_entered_at::date <= d.day::date
      ${personFilter}
    GROUP BY d.day::date, bc.name
    ORDER BY d.day::date, bc.name
  `)

  const columnSet = new Set<string>()
  const series: CumulativeFlowResponse['series'] = []

  for (const row of rows) {
    columnSet.add(row.column_name)
    series.push({
      date: row.date,
      columnName: row.column_name,
      count: parseInt(row.count, 10),
    })
  }

  const columns = Array.from(columnSet).sort()

  return c.json({ columns, series })
})
