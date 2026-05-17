import { Hono } from 'hono'
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
