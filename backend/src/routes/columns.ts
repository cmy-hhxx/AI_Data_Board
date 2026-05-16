import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { db } from '../db'
import { boardColumns } from '../db/schema'
import { eq, and } from 'drizzle-orm'

export const columnsRouter = new Hono()

columnsRouter.get('/:projectId/columns', async (c) => {
  const projectId = c.req.param('projectId')
  const rows = await db.select().from(boardColumns).where(eq(boardColumns.projectId, projectId)).orderBy(boardColumns.position)
  return c.json(rows)
})

columnsRouter.post('/:projectId/columns', zValidator('json', z.object({
  name: z.string().min(1),
  color: z.string().optional(),
})), async (c) => {
  const projectId = c.req.param('projectId')
  const body = c.req.valid('json')
  const [maxRow] = await db.select({ max: boardColumns.position }).from(boardColumns).where(eq(boardColumns.projectId, projectId))
  const position = (maxRow?.max ?? -1) + 1
  const [row] = await db.insert(boardColumns).values({ ...body, projectId, position }).returning()
  return c.json(row, 201)
})

columnsRouter.put('/:projectId/columns/:id', zValidator('json', z.object({
  name: z.string().min(1).optional(),
  color: z.string().optional(),
  position: z.number().int().min(0).optional(),
})), async (c) => {
  const { projectId, id } = c.req.param()
  const body = c.req.valid('json')
  const [row] = await db.update(boardColumns).set(body).where(and(eq(boardColumns.id, id), eq(boardColumns.projectId, projectId))).returning()
  if (!row) return c.json({ error: 'Not found' }, 404)
  return c.json(row)
})

columnsRouter.delete('/:projectId/columns/:id', async (c) => {
  const { projectId, id } = c.req.param()
  await db.delete(boardColumns).where(and(eq(boardColumns.id, id), eq(boardColumns.projectId, projectId)))
  return c.json({ success: true })
})
