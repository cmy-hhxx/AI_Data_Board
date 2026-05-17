import { config } from 'dotenv'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
config({ path: resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '.env') })

import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from '@ai-data-board/shared'
import { requestLogger } from './middleware/request-logger'
import { projectsRouter } from './routes/projects'
import { columnsRouter } from './routes/columns'
import { tasksRouter } from './routes/tasks'
import { tagsRouter } from './routes/tags'
import { attachmentsRouter } from './routes/attachments'

const TAG = 'Server'

const app = new Hono()

logger.info(TAG, '注册中间件: RequestLogger')
app.use('*', requestLogger)

logger.info(TAG, '注册中间件: CORS')
app.use('*', cors())

logger.info(TAG, '注册路由: /api/health')
app.get('/api/health', (c) => {
  logger.debug(TAG, 'GET /api/health')
  return c.json({ status: 'ok', timestamp: new Date().toISOString() })
})

logger.info(TAG, '注册路由: /api/config')
app.get('/api/config', (c) => {
  logger.debug(TAG, 'GET /api/config')
  const dbUrl = process.env.DATABASE_URL || ''
  const match = dbUrl.match(/postgresql:\/\/postgres\.([^.]+)\./)
  const projectRef = match ? match[1] : ''
  return c.json({
    supabaseUrl: `https://${projectRef}.supabase.co`,
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY || '',
  })
})

logger.info(TAG, '注册路由组: /api/projects')
app.route('/api/projects', projectsRouter)
logger.info(TAG, '注册路由组: /api/projects/columns')
app.route('/api/projects', columnsRouter)
logger.info(TAG, '注册路由组: /api/projects/tasks')
app.route('/api/projects', tasksRouter)
logger.info(TAG, '注册路由组: /api/tags')
app.route('/api/tags', tagsRouter)
logger.info(TAG, '注册路由组: /api/tasks/attachments')
app.route('/api/tasks', attachmentsRouter)

const port = Number(process.env.PORT) || 8787
logger.info(TAG, `服务启动 → http://localhost:${port}`)
serve({ fetch: app.fetch, port })
