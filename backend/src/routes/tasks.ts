import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { db } from '../db'
import { tasks, taskTags } from '../db/schema'
import { eq, and } from 'drizzle-orm'
import { logger } from '@ai-data-board/shared'

const TAG = 'Tasks'

export const tasksRouter = new Hono()

const taskSchema = z.object({
  title: z.string().min(1),
  columnId: z.string().optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  assignee: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  tagIds: z.array(z.string()).optional(),
})

tasksRouter.get('/:projectId/tasks', async (c) => {
  const projectId = c.req.param('projectId')
  const rows = await db.select().from(tasks).where(eq(tasks.projectId, projectId)).orderBy(tasks.position)
  return c.json(rows)
})

tasksRouter.post('/:projectId/tasks', zValidator('json', taskSchema), async (c) => {
  const projectId = c.req.param('projectId')
  const body = c.req.valid('json')
  const { tagIds, ...taskData } = body

  const [maxRow] = await db.select({ max: tasks.position }).from(tasks).where(and(eq(tasks.projectId, projectId), body.columnId ? eq(tasks.columnId, body.columnId) : undefined))
  const position = (maxRow?.max ?? -1) + 1

  const [row] = await db.insert(tasks).values({ ...taskData, projectId, position }).returning()

  if (tagIds && tagIds.length > 0) {
    await db.insert(taskTags).values(tagIds.map(tagId => ({ taskId: row.id, tagId })))
  }

  logger.info(TAG, `创建任务: "${row.title}" projectId=${projectId} (${row.id})`)
  return c.json(row, 201)
})

tasksRouter.put('/:projectId/tasks/:id', zValidator('json', taskSchema.partial()), async (c) => {
  const { projectId, id } = c.req.param()
  const body = c.req.valid('json')
  const { tagIds, ...taskData } = body

  const [row] = await db.update(tasks).set(taskData).where(and(eq(tasks.id, id), eq(tasks.projectId, projectId))).returning()
  if (!row) return c.json({ error: 'Not found' }, 404)

  if (tagIds !== undefined) {
    await db.delete(taskTags).where(eq(taskTags.taskId, id))
    if (tagIds.length > 0) {
      await db.insert(taskTags).values(tagIds.map(tagId => ({ taskId: id, tagId })))
    }
  }

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
  const { updates } = c.req.valid('json')
  for (const u of updates) {
    await db.update(tasks).set({ columnId: u.columnId, position: u.position }).where(eq(tasks.id, u.id))
  }
  logger.info(TAG, `批量排序任务: ${updates.length} 条`)
  return c.json({ success: true })
})
