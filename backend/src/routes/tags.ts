import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { db } from '../db'
import { tags } from '../db/schema'
import { eq } from 'drizzle-orm'
import { logger } from '@ai-data-board/shared'

const TAG = 'Tags'

export const tagsRouter = new Hono()

tagsRouter.get('/', async (c) => {
  const rows = await db.select().from(tags).orderBy(tags.name)
  logger.debug(TAG, `查询到 ${rows.length} 个标签`)
  return c.json(rows)
})

tagsRouter.post('/', zValidator('json', z.object({
  name: z.string().min(1),
  color: z.string().optional(),
})), async (c) => {
  const body = c.req.valid('json')
  const [row] = await db.insert(tags).values(body).returning()
  logger.info(TAG, `创建标签: "${row.name}" (${row.id})`)
  return c.json(row, 201)
})

tagsRouter.put('/:id', zValidator('json', z.object({
  name: z.string().min(1).optional(),
  color: z.string().optional(),
})), async (c) => {
  const id = c.req.param('id')
  const [row] = await db.update(tags).set(c.req.valid('json')).where(eq(tags.id, id)).returning()
  if (!row) return c.json({ error: 'Not found' }, 404)
  logger.info(TAG, `更新标签: "${row.name}" (${row.id})`)
  return c.json(row)
})

tagsRouter.delete('/:id', async (c) => {
  const id = c.req.param('id')
  await db.delete(tags).where(eq(tags.id, id))
  logger.info(TAG, `删除标签: ${id}`)
  return c.json({ success: true })
})
