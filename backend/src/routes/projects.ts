import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { db } from '../db'
import { projects } from '../db/schema'
import { eq } from 'drizzle-orm'

export const projectsRouter = new Hono()

projectsRouter.get('/', async (c) => {
  const rows = await db.select().from(projects).orderBy(projects.createdAt)
  return c.json(rows)
})

projectsRouter.post('/', zValidator('json', z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  color: z.string().optional(),
})), async (c) => {
  const body = c.req.valid('json')
  const [row] = await db.insert(projects).values(body).returning()
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
  return c.json(row)
})

projectsRouter.delete('/:id', async (c) => {
  const id = c.req.param('id')
  await db.delete(projects).where(eq(projects.id, id))
  return c.json({ success: true })
})
