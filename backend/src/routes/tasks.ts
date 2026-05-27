import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { db } from '../db'
import { tasks, boardColumns, taskProgressNotes, taskAssignees, users } from '../db/schema'
import { eq, and, desc, inArray } from 'drizzle-orm'
import { logger } from '@ai-data-board/shared'

const TAG = 'Tasks'

export const tasksRouter = new Hono()

const createTaskSchema = z.object({
  title: z.string().min(1),
  columnId: z.string().optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  assigneeNames: z.array(z.string()).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  blocker: z.string().optional(),
  estimatedDays: z.number().int().nullable().optional(),
})

const updateTaskSchema = z.object({
  title: z.string().min(1).optional(),
  columnId: z.string().nullable().optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  assigneeNames: z.array(z.string()).optional(),
  startDate: z.string().nullable().optional(),
  endDate: z.string().nullable().optional(),
  blocker: z.string().nullable().optional(),
  estimatedDays: z.number().int().nullable().optional(),
})

/** Resolve assignee names to user IDs, creating users as needed */
async function resolveAssignees(names: string[]): Promise<string[]> {
  const ids: string[] = []
  for (const name of names) {
    const trimmed = name.trim()
    if (!trimmed) continue
    let existing = await db.select().from(users).where(eq(users.name, trimmed)).limit(1)
    if (existing.length > 0) {
      ids.push(existing[0].id)
    } else {
      const [created] = await db.insert(users).values({ name: trimmed, role: 'annotator' }).returning()
      ids.push(created.id)
      logger.info(TAG, `自动创建用户: ${trimmed}`)
    }
  }
  return ids
}

/** Batch-fetch assignees for a set of task IDs, returns a map of taskId -> User[] */
async function fetchAssigneeMap(taskIds: string[]) {
  if (taskIds.length === 0) return new Map<string, Array<typeof users.$inferSelect>>()
  const rows = await db
    .select({ taskId: taskAssignees.taskId, user: users })
    .from(taskAssignees)
    .innerJoin(users, eq(taskAssignees.userId, users.id))
    .where(inArray(taskAssignees.taskId, taskIds))
  const map = new Map<string, Array<typeof users.$inferSelect>>()
  for (const r of rows) {
    if (!map.has(r.taskId)) map.set(r.taskId, [])
    map.get(r.taskId)!.push(r.user)
  }
  return map
}

tasksRouter.get('/:projectId/tasks', async (c) => {
  const projectId = c.req.param('projectId')
  const rows = await db.select().from(tasks).where(eq(tasks.projectId, projectId)).orderBy(tasks.position)
  const assigneeMap = await fetchAssigneeMap(rows.map(r => r.id))
  const result = rows.map(t => ({ ...t, assignees: assigneeMap.get(t.id) ?? [] }))
  return c.json(result)
})

tasksRouter.post('/:projectId/tasks', zValidator('json', createTaskSchema), async (c) => {
  const projectId = c.req.param('projectId')
  const body = c.req.valid('json')
  const { assigneeNames, ...taskData } = body

  const [maxRow] = await db.select({ max: tasks.position }).from(tasks).where(and(eq(tasks.projectId, projectId), taskData.columnId ? eq(tasks.columnId, taskData.columnId) : undefined))
  const position = (maxRow?.max ?? -1) + 1

  const [row] = await db.insert(tasks).values({
    ...taskData,
    projectId,
    position,
    columnEnteredAt: taskData.columnId ? new Date() : null,
  }).returning()

  if (assigneeNames && assigneeNames.length > 0) {
    const userIds = await resolveAssignees(assigneeNames)
    if (userIds.length > 0) {
      await db.insert(taskAssignees).values(userIds.map(userId => ({ taskId: row.id, userId })))
    }
  }

  const assigneeMap = await fetchAssigneeMap([row.id])
  logger.info(TAG, `创建任务: "${row.title}" projectId=${projectId} (${row.id})`)
  return c.json({ ...row, assignees: assigneeMap.get(row.id) ?? [] }, 201)
})

tasksRouter.put('/:projectId/tasks/:id', zValidator('json', updateTaskSchema), async (c) => {
  const { projectId, id } = c.req.param()
  const body = c.req.valid('json')
  const { assigneeNames, ...taskData } = body

  // Auto-set columnEnteredAt when columnId changes
  let columnEnteredAt: Date | undefined
  if (taskData.columnId !== undefined) {
    const [existing] = await db.select({ columnId: tasks.columnId }).from(tasks).where(and(eq(tasks.id, id), eq(tasks.projectId, projectId)))
    if (existing && existing.columnId !== taskData.columnId) {
      columnEnteredAt = new Date()
    }
  }

  const [row] = await db.update(tasks).set({
    ...taskData,
    ...(columnEnteredAt ? { columnEnteredAt } : {}),
  }).where(and(eq(tasks.id, id), eq(tasks.projectId, projectId))).returning()
  if (!row) return c.json({ error: 'Not found' }, 404)

  // Replace assignees if provided
  if (assigneeNames !== undefined) {
    await db.delete(taskAssignees).where(eq(taskAssignees.taskId, id))
    if (assigneeNames.length > 0) {
      const userIds = await resolveAssignees(assigneeNames)
      if (userIds.length > 0) {
        await db.insert(taskAssignees).values(userIds.map(userId => ({ taskId: id, userId })))
      }
    }
  }

  const assigneeMap = await fetchAssigneeMap([id])
  logger.info(TAG, `更新任务: "${row.title}" (${row.id})`)
  return c.json({ ...row, assignees: assigneeMap.get(id) ?? [] })
})

tasksRouter.delete('/:projectId/tasks/:id', async (c) => {
  const { projectId, id } = c.req.param()
  await db.delete(tasks).where(and(eq(tasks.id, id), eq(tasks.projectId, projectId)))
  logger.info(TAG, `删除任务: ${id}`)
  return c.json({ success: true })
})

// ── Per-task progress notes (history) ──

tasksRouter.get('/:projectId/tasks/:id/progress-notes', async (c) => {
  const id = c.req.param('id')
  const rows = await db.select().from(taskProgressNotes)
    .where(eq(taskProgressNotes.taskId, id))
    .orderBy(desc(taskProgressNotes.createdAt))
  return c.json(rows)
})

tasksRouter.post('/:projectId/tasks/:id/progress-notes', zValidator('json', z.object({
  content: z.string().min(1),
})), async (c) => {
  const id = c.req.param('id')
  const { content } = c.req.valid('json')
  const [row] = await db.insert(taskProgressNotes).values({ taskId: id, content }).returning()
  logger.info(TAG, `添加进度备注: task=${id} note=${row.id}`)
  return c.json(row, 201)
})

tasksRouter.delete('/:projectId/tasks/:id/progress-notes/:noteId', async (c) => {
  const noteId = c.req.param('noteId')
  await db.delete(taskProgressNotes).where(eq(taskProgressNotes.id, noteId))
  logger.info(TAG, `删除进度备注: ${noteId}`)
  return c.json({ success: true })
})

// Batch update positions (drag-and-drop reorder)
tasksRouter.patch('/:projectId/tasks/reorder', zValidator('json', z.object({
  updates: z.array(z.object({
    id: z.string(),
    columnId: z.string(),
    position: z.number().int().min(0),
  })),
})), async (c) => {
  const projectId = c.req.param('projectId')
  const { updates } = c.req.valid('json')

  // Fetch columns sorted by position to determine first/last column
  const columns = await db.select().from(boardColumns).where(eq(boardColumns.projectId, projectId)).orderBy(boardColumns.position)
  const firstColumnId = columns[0]?.id
  const lastColumnId = columns[columns.length - 1]?.id

  await db.transaction(async (tx) => {
    for (const u of updates) {
      const [existing] = await tx
        .select({ columnId: tasks.columnId, startDate: tasks.startDate })
        .from(tasks)
        .where(and(eq(tasks.id, u.id), eq(tasks.projectId, projectId)))

      if (!existing) continue

      let startDate: string | null | undefined = undefined
      let endDate: string | null | undefined = undefined

      if (existing.columnId !== u.columnId) {
        if (u.columnId === lastColumnId) {
          endDate = new Date().toISOString().split('T')[0]
        } else if (u.columnId === firstColumnId) {
          startDate = null
          endDate = null
        } else {
          // Middle column
          startDate = existing.startDate ?? new Date().toISOString().split('T')[0]
          endDate = null
        }

        const setData: Record<string, unknown> = {
          columnId: u.columnId,
          position: u.position,
          columnEnteredAt: new Date(),
        }
        if (startDate !== undefined) setData.startDate = startDate
        if (endDate !== undefined) setData.endDate = endDate

        await tx
          .update(tasks)
          .set(setData)
          .where(and(eq(tasks.id, u.id), eq(tasks.projectId, projectId)))
      } else {
        await tx
          .update(tasks)
          .set({
            columnId: u.columnId,
            position: u.position,
          })
          .where(and(eq(tasks.id, u.id), eq(tasks.projectId, projectId)))
      }
    }
  })
  logger.info(TAG, `批量排序任务: ${updates.length} 条`)
  return c.json({ success: true })
})
