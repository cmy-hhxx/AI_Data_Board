import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { db } from '../db/index.js'
import { boardColumns } from '../db/schema.js'
import { eq, and } from 'drizzle-orm'
import { logger } from '@ai-data-board/shared'
import { isLocalStoreEnabled, localStore } from '../storage/local-store.js'

const TAG = 'Columns'

export const columnsRouter = new Hono()

columnsRouter.get('/:projectId/columns', async (c) => {
  const projectId = c.req.param('projectId')
  if (isLocalStoreEnabled) {
    const rows = localStore.listColumns(projectId)
    logger.debug(TAG, `查询列: projectId=${projectId}, count=${rows.length}（local）`)
    return c.json(rows)
  }
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
  if (isLocalStoreEnabled) {
    const row = localStore.createColumn(projectId, body)
    logger.info(TAG, `创建列: "${row.name}" projectId=${projectId} (${row.id}) [local]`)
    return c.json(row, 201)
  }
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
  if (isLocalStoreEnabled) {
    const row = localStore.updateColumn(projectId, id, body)
    if (!row) return c.json({ error: 'Not found' }, 404)
    logger.info(TAG, `更新列: "${row.name}" (${row.id}) [local]`)
    return c.json(row)
  }
  const [row] = await db.update(boardColumns).set(body).where(and(eq(boardColumns.id, id), eq(boardColumns.projectId, projectId))).returning()
  if (!row) return c.json({ error: 'Not found' }, 404)
  logger.info(TAG, `更新列: "${row.name}" (${row.id})`)
  return c.json(row)
})

columnsRouter.delete('/:projectId/columns/:id', async (c) => {
  const { projectId, id } = c.req.param()
  if (isLocalStoreEnabled) {
    localStore.deleteColumn(projectId, id)
    logger.info(TAG, `删除列: ${id} [local]`)
    return c.json({ success: true })
  }
  await db.delete(boardColumns).where(and(eq(boardColumns.id, id), eq(boardColumns.projectId, projectId)))
  logger.info(TAG, `删除列: ${id}`)
  return c.json({ success: true })
})
