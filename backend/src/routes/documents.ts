import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { db } from '../db'
import { documents } from '../db/schema'
import { eq } from 'drizzle-orm'
import { logger } from '@ai-data-board/shared'

const TAG = 'Documents'

export const documentsRouter = new Hono()

// Mounted under /api/projects — paths are project-scoped to mirror columns/tasks.

documentsRouter.get('/:projectId/documents', async (c) => {
  const projectId = c.req.param('projectId')
  const rows = await db.select().from(documents)
    .where(eq(documents.projectId, projectId))
    .orderBy(documents.position)
  return c.json(rows)
})

documentsRouter.post('/:projectId/documents', zValidator('json', z.object({
  name: z.string().min(1),
  url: z.string().optional(),
  content: z.string().optional(),
})), async (c) => {
  const projectId = c.req.param('projectId')
  const body = c.req.valid('json')
  const [maxRow] = await db.select({ max: documents.position }).from(documents)
    .where(eq(documents.projectId, projectId))
  const position = (maxRow?.max ?? -1) + 1
  const [row] = await db.insert(documents).values({ ...body, projectId, position }).returning()
  logger.info(TAG, `创建文档: "${row.name}" (${row.id}) → project ${projectId}`)
  return c.json(row, 201)
})

documentsRouter.delete('/:projectId/documents/:id', async (c) => {
  const id = c.req.param('id')
  await db.delete(documents).where(eq(documents.id, id))
  logger.info(TAG, `删除文档: ${id}`)
  return c.json({ success: true })
})

documentsRouter.patch('/:projectId/documents/reorder', zValidator('json', z.object({
  updates: z.array(z.object({
    id: z.string(),
    position: z.number().int().min(0),
  })),
})), async (c) => {
  const { updates } = c.req.valid('json')
  for (const u of updates) {
    await db.update(documents).set({ position: u.position }).where(eq(documents.id, u.id))
  }
  return c.json({ success: true })
})
