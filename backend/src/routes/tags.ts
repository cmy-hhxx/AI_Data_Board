import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { db } from '../db'
import { tags } from '../db/schema'
import { eq } from 'drizzle-orm'

export const tagsRouter = new Hono()

tagsRouter.get('/', async (c) => {
  const rows = await db.select().from(tags).orderBy(tags.name)
  return c.json(rows)
})

tagsRouter.post('/', zValidator('json', z.object({
  name: z.string().min(1),
  color: z.string().optional(),
})), async (c) => {
  const body = c.req.valid('json')
  const [row] = await db.insert(tags).values(body).returning()
  return c.json(row, 201)
})

tagsRouter.put('/:id', zValidator('json', z.object({
  name: z.string().min(1).optional(),
  color: z.string().optional(),
})), async (c) => {
  const id = c.req.param('id')
  const [row] = await db.update(tags).set(c.req.valid('json')).where(eq(tags.id, id)).returning()
  if (!row) return c.json({ error: 'Not found' }, 404)
  return c.json(row)
})

tagsRouter.delete('/:id', async (c) => {
  const id = c.req.param('id')
  await db.delete(tags).where(eq(tags.id, id))
  return c.json({ success: true })
})
