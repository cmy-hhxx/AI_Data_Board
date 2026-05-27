import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { db } from '../db'
import { projects, boardColumns, tasks, taskAssignees, users } from '../db/schema'
import { eq, isNull, isNotNull, sql, and } from 'drizzle-orm'
import { logger } from '@ai-data-board/shared'

const TAG = 'Projects'

const DEFAULT_COLUMNS = ['待分配', '进行中', '紧急通道', '已完成']

export const projectsRouter = new Hono()

projectsRouter.get('/', async (c) => {
  const includeArchived = c.req.query('includeArchived') === 'true'
  const condition = includeArchived ? isNotNull(projects.archivedAt) : isNull(projects.archivedAt)
  const rows = await db.select().from(projects).where(condition).orderBy(projects.createdAt)

  let result: Array<typeof rows[number] & { taskCount: number; members: Array<{ id: string; name: string }> }> = []

  if (rows.length > 0) {
    const projectIds = rows.map(r => r.id)

    // Use explicit ::uuid casting — inArray sends params as text[] on some platforms
    const uuidList = sql.join(projectIds.map(id => sql`${id}::uuid`), sql`, `)

    // Batch: task counts per project
    const taskCounts = await db
      .select({ projectId: tasks.projectId, count: sql<number>`count(*)` })
      .from(tasks)
      .where(sql`${tasks.projectId} IN (${uuidList})`)
      .groupBy(tasks.projectId)

    // Batch: assignees per project (deduped in app layer)
    const allMembers = await db
      .select({ projectId: tasks.projectId, userId: taskAssignees.userId, userName: users.name })
      .from(taskAssignees)
      .innerJoin(tasks, eq(taskAssignees.taskId, tasks.id))
      .innerJoin(users, eq(taskAssignees.userId, users.id))
      .where(sql`${tasks.projectId} IN (${uuidList})`)

    const countMap = new Map(taskCounts.map(r => [r.projectId, Number(r.count)]))
    const membersMap = new Map<string, Array<{ id: string; name: string }>>()
    for (const m of allMembers) {
      if (!membersMap.has(m.projectId)) membersMap.set(m.projectId, [])
      const arr = membersMap.get(m.projectId)!
      if (!arr.find(x => x.id === m.userId)) arr.push({ id: m.userId, name: m.userName })
    }

    result = rows.map(project => ({
      ...project,
      taskCount: countMap.get(project.id) ?? 0,
      members: (membersMap.get(project.id) ?? []).slice(0, 2),
    }))
  }

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
