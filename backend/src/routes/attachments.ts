import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { db } from '../db'
import { attachments } from '../db/schema'
import { eq } from 'drizzle-orm'

export const attachmentsRouter = new Hono()

attachmentsRouter.get('/:taskId/attachments', async (c) => {
  const taskId = c.req.param('taskId')
  const rows = await db.select().from(attachments).where(eq(attachments.taskId, taskId)).orderBy(attachments.createdAt)
  return c.json(rows)
})

attachmentsRouter.post('/:taskId/attachments', zValidator('json', z.object({
  name: z.string().min(1),
  type: z.enum(['file', 'link', 'image', 'code']),
  url: z.string().optional(),
  content: z.string().optional(),
  size: z.number().int().optional(),
})), async (c) => {
  const taskId = c.req.param('taskId')
  const body = c.req.valid('json')
  const [row] = await db.insert(attachments).values({ ...body, taskId }).returning()
  return c.json(row, 201)
})

attachmentsRouter.delete('/:taskId/attachments/:id', async (c) => {
  const { taskId, id } = c.req.param()
  await db.delete(attachments).where(eq(attachments.id, id))
  return c.json({ success: true })
})
