import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { db } from '../db'
import { boardColumns } from '../db/schema'
import { eq, and } from 'drizzle-orm'
import { logger } from '@ai-data-board/shared'

const TAG = 'Columns'

export const columnsRouter = new Hono()

columnsRouter.get('/:projectId/columns', async (c) => {
  const projectId = c.req.param('projectId')
  const rows = await db.select().from(boardColumns).where(eq(boardColumns.projectId, projectId)).orderBy(boardColumns.position)
  logger.debug(TAG, `查询列: projectId=${projectId}, count=${rows.length}`)
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
  logger.info(TAG, `创建列: "${row.name}" projectId=${projectId} (${row.id})`)
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
  logger.info(TAG, `更新列: "${row.name}" (${row.id})`)
  return c.json(row)
})

columnsRouter.delete('/:projectId/columns/:id', async (c) => {
  const { projectId, id } = c.req.param()
  await db.delete(boardColumns).where(and(eq(boardColumns.id, id), eq(boardColumns.projectId, projectId)))
  logger.info(TAG, `删除列: ${id}`)
  return c.json({ success: true })
})
