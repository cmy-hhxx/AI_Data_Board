import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { db } from '../db'
import { tasks, boardColumns } from '../db/schema'
import { eq, and } from 'drizzle-orm'
import { logger } from '@ai-data-board/shared'

const TAG = 'Tasks'

export const tasksRouter = new Hono()

const createTaskSchema = z.object({
  title: z.string().min(1),
  columnId: z.string().optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  assignee: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  blocker: z.string().optional(),
  estimatedDays: z.number().int().nullable().optional(),
})

const updateTaskSchema = z.object({
  title: z.string().min(1).optional(),
  columnId: z.string().nullable().optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  assignee: z.string().nullable().optional(),
  startDate: z.string().nullable().optional(),
  endDate: z.string().nullable().optional(),
  blocker: z.string().nullable().optional(),
  estimatedDays: z.number().int().nullable().optional(),
})

tasksRouter.get('/:projectId/tasks', async (c) => {
  const projectId = c.req.param('projectId')
  const rows = await db.select().from(tasks).where(eq(tasks.projectId, projectId)).orderBy(tasks.position)
  return c.json(rows)
})

tasksRouter.post('/:projectId/tasks', zValidator('json', createTaskSchema), async (c) => {
  const projectId = c.req.param('projectId')
  const body = c.req.valid('json')

  const [maxRow] = await db.select({ max: tasks.position }).from(tasks).where(and(eq(tasks.projectId, projectId), body.columnId ? eq(tasks.columnId, body.columnId) : undefined))
  const position = (maxRow?.max ?? -1) + 1

  const [row] = await db.insert(tasks).values({
    ...body,
    projectId,
    position,
    columnEnteredAt: body.columnId ? new Date() : null,
  }).returning()

  logger.info(TAG, `创建任务: "${row.title}" projectId=${projectId} (${row.id})`)
  return c.json(row, 201)
})

tasksRouter.put('/:projectId/tasks/:id', zValidator('json', updateTaskSchema), async (c) => {
  const { projectId, id } = c.req.param()
  const body = c.req.valid('json')

  // Auto-set columnEnteredAt when columnId changes
  let columnEnteredAt: Date | undefined
  if (body.columnId !== undefined) {
    const [existing] = await db.select({ columnId: tasks.columnId }).from(tasks).where(and(eq(tasks.id, id), eq(tasks.projectId, projectId)))
    if (existing && existing.columnId !== body.columnId) {
      columnEnteredAt = new Date()
    }
  }

  const [row] = await db.update(tasks).set({
    ...body,
    ...(columnEnteredAt ? { columnEnteredAt } : {}),
  }).where(and(eq(tasks.id, id), eq(tasks.projectId, projectId))).returning()
  if (!row) return c.json({ error: 'Not found' }, 404)

  logger.info(TAG, `更新任务: "${row.title}" (${row.id})`)
  return c.json(row)
})

tasksRouter.delete('/:projectId/tasks/:id', async (c) => {
  const { projectId, id } = c.req.param()
  await db.delete(tasks).where(and(eq(tasks.id, id), eq(tasks.projectId, projectId)))
  logger.info(TAG, `删除任务: ${id}`)
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
