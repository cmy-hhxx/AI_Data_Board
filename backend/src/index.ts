import { readFile } from 'fs/promises'
import { existsSync } from 'fs'
import { resolve, dirname, join, extname } from 'path'
import { fileURLToPath } from 'url'
import { config } from 'dotenv'
import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from '@ai-data-board/shared'
import { requestLogger } from './middleware/request-logger'
import { projectsRouter } from './routes/projects'
import { columnsRouter } from './routes/columns'
import { tasksRouter } from './routes/tasks'
import { documentsRouter } from './routes/documents'
import { usersRouter } from './routes/users'
import { timelineRouter } from './routes/timeline'

config({ path: resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '.env') })

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
  const match = dbUrl.match(/postgres\.([^:@]+)/)
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
logger.info(TAG, '注册路由组: /api/projects/:id/documents')
app.route('/api/projects', documentsRouter)
logger.info(TAG, '注册路由组: /api/users')
app.route('/api', usersRouter)
logger.info(TAG, '注册路由组: /api/timeline')
app.route('/api', timelineRouter)

// Global error handler — catches unhandled route errors and logs them
app.onError((err, c) => {
  logger.error(TAG, `未处理的错误: ${err.message}`, { stack: err.stack })
  return c.json({ error: 'Internal server error', message: err.message }, 500)
})

// Static file serving (production only — when frontend/dist exists)
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const staticDir = join(__dirname, '..', '..', 'frontend', 'dist')
const distExists = existsSync(staticDir)

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript',
  '.mjs': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
}

app.get('*', async (c) => {
  if (!distExists) return c.notFound()
  const url = new URL(c.req.url)
  const filePath = join(staticDir, url.pathname === '/' ? 'index.html' : url.pathname)
  try {
    const content = await readFile(filePath)
    const ext = extname(filePath)
    return new Response(content, {
      headers: { 'Content-Type': MIME[ext] || 'application/octet-stream' },
    })
  } catch {
    try {
      const content = await readFile(join(staticDir, 'index.html'))
      return new Response(content, {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      })
    } catch {
      return c.notFound()
    }
  }
})

const port = Number(process.env.PORT) || 8787
logger.info(TAG, `服务启动 → http://localhost:${port}`)
serve({ fetch: app.fetch, port })
