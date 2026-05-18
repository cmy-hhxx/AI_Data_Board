import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { db } from '../db'
import { users } from '../db/schema'
import { eq } from 'drizzle-orm'
import { logger } from '@ai-data-board/shared'

const TAG = 'Users'

export const usersRouter = new Hono()

const roleEnum = z.enum(['supervisor', 'pm', 'algorithm', 'annotator', 'crawler', 'intern'])

usersRouter.get('/users', async (c) => {
  const rows = await db.select().from(users).orderBy(users.name)
  logger.debug(TAG, `查询用户列表: ${rows.length} 条`)
  return c.json(rows)
})

usersRouter.post('/users', zValidator('json', z.object({
  name: z.string().min(1),
  role: roleEnum,
})), async (c) => {
  const body = c.req.valid('json')
  const [row] = await db.insert(users).values(body).returning()
  logger.info(TAG, `创建用户: "${row.name}" (${row.id})`)
  return c.json(row, 201)
})

usersRouter.put('/users/:id', zValidator('json', z.object({
  name: z.string().min(1).optional(),
  role: roleEnum.optional(),
})), async (c) => {
  const id = c.req.param('id')
  const body = c.req.valid('json')
  const [row] = await db.update(users).set(body).where(eq(users.id, id)).returning()
  if (!row) return c.json({ error: 'Not found' }, 404)
  logger.info(TAG, `更新用户: "${row.name}" (${row.id})`)
  return c.json(row)
})

usersRouter.delete('/users/:id', async (c) => {
  const id = c.req.param('id')
  await db.delete(users).where(eq(users.id, id))
  logger.info(TAG, `删除用户: ${id}`)
  return c.json({ success: true })
})
