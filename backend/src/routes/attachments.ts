import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { db } from '../db'
import { attachments } from '../db/schema'
import { eq, and, isNull } from 'drizzle-orm'
import { logger } from '@ai-data-board/shared'

const TAG = 'Attachments'

export const attachmentsRouter = new Hono()

// List: ?scope=project&projectId=xxx  or  ?scope=task&taskId=xxx
attachmentsRouter.get('/', async (c) => {
  const scope = c.req.query('scope')
  const projectId = c.req.query('projectId')
  const taskId = c.req.query('taskId')

  let rows
  if (scope === 'project' && projectId) {
    rows = await db.select().from(attachments)
      .where(and(eq(attachments.projectId, projectId), isNull(attachments.taskId)))
      .orderBy(attachments.createdAt)
  } else if (taskId) {
    rows = await db.select().from(attachments)
      .where(eq(attachments.taskId, taskId))
      .orderBy(attachments.createdAt)
  } else if (projectId) {
    rows = await db.select().from(attachments)
      .where(eq(attachments.projectId, projectId))
      .orderBy(attachments.createdAt)
  } else {
    rows = await db.select().from(attachments).orderBy(attachments.createdAt)
  }

  logger.debug(TAG, `查询文档: count=${rows.length}`)
  return c.json(rows)
})

attachmentsRouter.post('/', zValidator('json', z.object({
  projectId: z.string().optional(),
  taskId: z.string().optional(),
  name: z.string().min(1),
  type: z.enum(['file', 'link', 'image', 'code']),
  url: z.string().optional(),
  content: z.string().optional(),
  size: z.number().int().optional(),
})), async (c) => {
  const body = c.req.valid('json')
  const [row] = await db.insert(attachments).values(body).returning()
  logger.info(TAG, `创建文档: "${row.name}" (${row.id})`)
  return c.json(row, 201)
})

attachmentsRouter.delete('/:id', async (c) => {
  const id = c.req.param('id')
  await db.delete(attachments).where(eq(attachments.id, id))
  logger.info(TAG, `删除文档: ${id}`)
  return c.json({ success: true })
})
