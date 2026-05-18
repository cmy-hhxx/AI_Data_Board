import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { db } from '../db/index.js'
import { projects } from '../db/schema.js'
import { eq } from 'drizzle-orm'
import { logger } from '@ai-data-board/shared'
import { isLocalStoreEnabled, localStore } from '../storage/local-store.js'

const TAG = 'Projects'

export const projectsRouter = new Hono()

projectsRouter.get('/', async (c) => {
  if (isLocalStoreEnabled) {
    const rows = localStore.listProjects()
    logger.debug(TAG, `查询到 ${rows.length} 个项目（local）`)
    return c.json(rows)
  }
  const rows = await db.select().from(projects).orderBy(projects.createdAt)
  logger.debug(TAG, `查询到 ${rows.length} 个项目`)
  return c.json(rows)
})

projectsRouter.post('/', zValidator('json', z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  color: z.string().optional(),
})), async (c) => {
  const body = c.req.valid('json')
  if (isLocalStoreEnabled) {
    const row = localStore.createProject(body)
    logger.info(TAG, `创建项目: "${row.name}" (${row.id}) [local]`)
    return c.json(row, 201)
  }
  const [row] = await db.insert(projects).values(body).returning()
  logger.info(TAG, `创建项目: "${row.name}" (${row.id})`)
  return c.json(row, 201)
})

projectsRouter.put('/:id', zValidator('json', z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  color: z.string().optional(),
})), async (c) => {
  const id = c.req.param('id')
  const body = c.req.valid('json')
  if (isLocalStoreEnabled) {
    const row = localStore.updateProject(id, body)
    if (!row) return c.json({ error: 'Not found' }, 404)
    logger.info(TAG, `更新项目: "${row.name}" (${row.id}) [local]`)
    return c.json(row)
  }
  const [row] = await db.update(projects).set(body).where(eq(projects.id, id)).returning()
  if (!row) return c.json({ error: 'Not found' }, 404)
  logger.info(TAG, `更新项目: "${row.name}" (${row.id})`)
  return c.json(row)
})

projectsRouter.delete('/:id', async (c) => {
  const id = c.req.param('id')
  if (isLocalStoreEnabled) {
    localStore.deleteProject(id)
    logger.info(TAG, `删除项目: ${id} [local]`)
    return c.json({ success: true })
  }
  await db.delete(projects).where(eq(projects.id, id))
  logger.info(TAG, `删除项目: ${id}`)
  return c.json({ success: true })
})
