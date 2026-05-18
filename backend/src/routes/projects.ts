import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { db } from '../db'
import { projects, boardColumns } from '../db/schema'
import { eq } from 'drizzle-orm'
import { logger } from '@ai-data-board/shared'

const TAG = 'Projects'

const DEFAULT_COLUMNS = ['待分配', '进行中', '紧急通道', '已完成']

export const projectsRouter = new Hono()

projectsRouter.get('/', async (c) => {
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

  const [row] = await db.transaction(async (tx) => {
    const [project] = await tx.insert(projects).values(body).returning()

    await tx.insert(boardColumns).values(
      DEFAULT_COLUMNS.map((name, i) => ({
        projectId: project.id,
        name,
        position: i,
      }))
    )

    return [project]
  })

  logger.info(TAG, `创建项目: "${row.name}" (${row.id})，已预设 ${DEFAULT_COLUMNS.length} 个列`)
  return c.json(row, 201)
})

projectsRouter.put('/:id', zValidator('json', z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  color: z.string().optional(),
})), async (c) => {
  const id = c.req.param('id')
  const body = c.req.valid('json')
  const [row] = await db.update(projects).set(body).where(eq(projects.id, id)).returning()
  if (!row) return c.json({ error: 'Not found' }, 404)
  logger.info(TAG, `更新项目: "${row.name}" (${row.id})`)
  return c.json(row)
})

projectsRouter.delete('/:id', async (c) => {
  const id = c.req.param('id')
  await db.delete(projects).where(eq(projects.id, id))
  logger.info(TAG, `删除项目: ${id}`)
  return c.json({ success: true })
})
