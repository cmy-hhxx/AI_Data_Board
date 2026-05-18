import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { db } from '../db/index.js'
import { tags } from '../db/schema.js'
import { eq } from 'drizzle-orm'
import { logger } from '@ai-data-board/shared'
import { isLocalStoreEnabled, localStore } from '../storage/local-store.js'

const TAG = 'Tags'

export const tagsRouter = new Hono()

tagsRouter.get('/', async (c) => {
  if (isLocalStoreEnabled) {
    const rows = localStore.listTags()
    logger.debug(TAG, `查询到 ${rows.length} 个标签（local）`)
    return c.json(rows)
  }
  const rows = await db.select().from(tags).orderBy(tags.name)
  logger.debug(TAG, `查询到 ${rows.length} 个标签`)
  return c.json(rows)
})

tagsRouter.post('/', zValidator('json', z.object({
  name: z.string().min(1),
  color: z.string().optional(),
})), async (c) => {
  const body = c.req.valid('json')
  if (isLocalStoreEnabled) {
    const row = localStore.createTag(body)
    logger.info(TAG, `创建标签: "${row.name}" (${row.id}) [local]`)
    return c.json(row, 201)
  }
  const [row] = await db.insert(tags).values(body).returning()
  logger.info(TAG, `创建标签: "${row.name}" (${row.id})`)
  return c.json(row, 201)
})

tagsRouter.put('/:id', zValidator('json', z.object({
  name: z.string().min(1).optional(),
  color: z.string().optional(),
})), async (c) => {
  const id = c.req.param('id')
  if (isLocalStoreEnabled) {
    const row = localStore.updateTag(id, c.req.valid('json'))
    if (!row) return c.json({ error: 'Not found' }, 404)
    logger.info(TAG, `更新标签: "${row.name}" (${row.id}) [local]`)
    return c.json(row)
  }
  const [row] = await db.update(tags).set(c.req.valid('json')).where(eq(tags.id, id)).returning()
  if (!row) return c.json({ error: 'Not found' }, 404)
  logger.info(TAG, `更新标签: "${row.name}" (${row.id})`)
  return c.json(row)
})

tagsRouter.delete('/:id', async (c) => {
  const id = c.req.param('id')
  if (isLocalStoreEnabled) {
    localStore.deleteTag(id)
    logger.info(TAG, `删除标签: ${id} [local]`)
    return c.json({ success: true })
  }
  await db.delete(tags).where(eq(tags.id, id))
  logger.info(TAG, `删除标签: ${id}`)
  return c.json({ success: true })
})
