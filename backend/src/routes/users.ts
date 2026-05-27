import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { db } from '../db'
import { users } from '../db/schema'
import { logger } from '@ai-data-board/shared'

const TAG = 'Users'

export const usersRouter = new Hono()

usersRouter.get('/users', async (c) => {
  const rows = await db.select().from(users).orderBy(users.name)
  logger.debug(TAG, `查询用户列表: ${rows.length} 条`)
  return c.json(rows)
})

const createUserSchema = z.object({
  name: z.string().min(1),
  role: z.enum(['supervisor', 'pm', 'algorithm', 'annotator', 'crawler', 'intern']).default('annotator'),
})

usersRouter.post('/users', zValidator('json', createUserSchema), async (c) => {
  const { name, role } = c.req.valid('json')
  const [row] = await db.insert(users).values({ name, role }).returning()
  logger.info(TAG, `创建用户: ${name} (${role})`)
  return c.json(row, 201)
})
