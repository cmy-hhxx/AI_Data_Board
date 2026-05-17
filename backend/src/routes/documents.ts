import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { db } from '../db'
import { knowledgeBases, documents } from '../db/schema'
import { eq } from 'drizzle-orm'
import { logger } from '@ai-data-board/shared'
import { isLocalStoreEnabled, localStore } from '../storage/local-store'

const TAG = 'Documents'

export const documentsRouter = new Hono()

// ── Knowledge Bases ──

documentsRouter.get('/knowledge-bases', async (c) => {
  if (isLocalStoreEnabled) {
    return c.json(localStore.listKnowledgeBases())
  }
  const rows = await db.select().from(knowledgeBases).orderBy(knowledgeBases.position)
  return c.json(rows)
})

documentsRouter.post('/knowledge-bases', zValidator('json', z.object({
  name: z.string().min(1),
})), async (c) => {
  const body = c.req.valid('json')
  if (isLocalStoreEnabled) {
    const row = localStore.createKnowledgeBase(body.name)
    logger.info(TAG, `创建知识库: "${row.name}" (${row.id}) [local]`)
    return c.json(row, 201)
  }
  const [maxRow] = await db.select({ max: knowledgeBases.position }).from(knowledgeBases)
  const position = (maxRow?.max ?? -1) + 1
  const [row] = await db.insert(knowledgeBases).values({ name: body.name, position }).returning()
  logger.info(TAG, `创建知识库: "${row.name}" (${row.id})`)
  return c.json(row, 201)
})

documentsRouter.delete('/knowledge-bases/:id', async (c) => {
  const id = c.req.param('id')
  if (isLocalStoreEnabled) {
    localStore.deleteKnowledgeBase(id)
    logger.info(TAG, `删除知识库: ${id} [local]`)
    return c.json({ success: true })
  }
  await db.delete(knowledgeBases).where(eq(knowledgeBases.id, id))
  logger.info(TAG, `删除知识库: ${id}`)
  return c.json({ success: true })
})

documentsRouter.patch('/knowledge-bases/reorder', zValidator('json', z.object({
  updates: z.array(z.object({
    id: z.string(),
    position: z.number().int().min(0),
  })),
})), async (c) => {
  const { updates } = c.req.valid('json')
  if (isLocalStoreEnabled) {
    localStore.reorderKnowledgeBases(updates)
    return c.json({ success: true })
  }
  for (const u of updates) {
    await db.update(knowledgeBases).set({ position: u.position }).where(eq(knowledgeBases.id, u.id))
  }
  return c.json({ success: true })
})

// ── Documents ──

documentsRouter.get('/knowledge-bases/:kbId/documents', async (c) => {
  const kbId = c.req.param('kbId')
  if (isLocalStoreEnabled) {
    return c.json(localStore.listDocuments(kbId))
  }
  const rows = await db.select().from(documents)
    .where(eq(documents.knowledgeBaseId, kbId))
    .orderBy(documents.position)
  return c.json(rows)
})

documentsRouter.post('/knowledge-bases/:kbId/documents', zValidator('json', z.object({
  name: z.string().min(1),
  url: z.string().optional(),
  content: z.string().optional(),
})), async (c) => {
  const kbId = c.req.param('kbId')
  const body = c.req.valid('json')
  if (isLocalStoreEnabled) {
    const row = localStore.createDocument(kbId, body)
    logger.info(TAG, `创建文档: "${row.name}" (${row.id}) [local]`)
    return c.json(row, 201)
  }
  const [maxRow] = await db.select({ max: documents.position }).from(documents)
    .where(eq(documents.knowledgeBaseId, kbId))
  const position = (maxRow?.max ?? -1) + 1
  const [row] = await db.insert(documents).values({ ...body, knowledgeBaseId: kbId, position }).returning()
  logger.info(TAG, `创建文档: "${row.name}" (${row.id})`)
  return c.json(row, 201)
})

documentsRouter.delete('/documents/:id', async (c) => {
  const id = c.req.param('id')
  if (isLocalStoreEnabled) {
    localStore.deleteDocument(id)
    logger.info(TAG, `删除文档: ${id} [local]`)
    return c.json({ success: true })
  }
  await db.delete(documents).where(eq(documents.id, id))
  logger.info(TAG, `删除文档: ${id}`)
  return c.json({ success: true })
})

documentsRouter.patch('/knowledge-bases/:kbId/documents/reorder', zValidator('json', z.object({
  updates: z.array(z.object({
    id: z.string(),
    position: z.number().int().min(0),
  })),
})), async (c) => {
  const { updates } = c.req.valid('json')
  if (isLocalStoreEnabled) {
    localStore.reorderDocuments(updates)
    return c.json({ success: true })
  }
  for (const u of updates) {
    await db.update(documents).set({ position: u.position }).where(eq(documents.id, u.id))
  }
  return c.json({ success: true })
})
