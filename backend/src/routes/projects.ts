import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { db } from '../db'
import { projects, boardColumns, tasks, users } from '../db/schema'
import { eq, isNull, isNotNull, sql } from 'drizzle-orm'
import { logger } from '@ai-data-board/shared'

const TAG = 'Projects'

const DEFAULT_COLUMNS = ['待分配', '进行中', '紧急通道', '已完成']

export const projectsRouter = new Hono()

projectsRouter.get('/', async (c) => {
  const includeArchived = c.req.query('includeArchived') === 'true'
  const condition = includeArchived ? isNotNull(projects.archivedAt) : isNull(projects.archivedAt)
  const rows = await db.select().from(projects).where(condition).orderBy(projects.createdAt)

  const result = await Promise.all(rows.map(async (project) => {
    const [countRow] = await db.select({ count: sql<number>`count(*)` }).from(tasks).where(eq(tasks.projectId, project.id))
    const allMembers = await db
      .select({ id: users.id, name: users.name })
      .from(tasks)
      .innerJoin(users, eq(tasks.assignee, users.id))
      .where(eq(tasks.projectId, project.id))
    const members = allMembers
      .filter((m, i, arr) => arr.findIndex(x => x.id === m.id) === i)
      .slice(0, 2)
    return { ...project, taskCount: Number(countRow.count), members }
  }))

  logger.debug(TAG, `查询到 ${rows.length} 个项目${includeArchived ? '(已归档)' : ''}`)
  return c.json(result)
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
  return c.json({ ...row, taskCount: 0, members: [] }, 201)
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

projectsRouter.patch('/:id/archive', async (c) => {
  const id = c.req.param('id')
  const [row] = await db.update(projects).set({ archivedAt: new Date() }).where(eq(projects.id, id)).returning()
  if (!row) return c.json({ error: 'Not found' }, 404)
  logger.info(TAG, `归档项目: "${row.name}" (${row.id})`)
  return c.json(row)
})

projectsRouter.patch('/:id/restore', async (c) => {
  const id = c.req.param('id')
  const [row] = await db.update(projects).set({ archivedAt: null }).where(eq(projects.id, id)).returning()
  if (!row) return c.json({ error: 'Not found' }, 404)
  logger.info(TAG, `恢复项目: "${row.name}" (${row.id})`)
  return c.json(row)
})

projectsRouter.delete('/:id', async (c) => {
  const id = c.req.param('id')
  await db.delete(projects).where(eq(projects.id, id))
  logger.info(TAG, `删除项目: ${id}`)
  return c.json({ success: true })
})
