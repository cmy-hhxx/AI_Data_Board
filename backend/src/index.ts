import { config } from 'dotenv'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
config({ path: resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '.env') })

import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { projectsRouter } from './routes/projects'
import { columnsRouter } from './routes/columns'
import { tasksRouter } from './routes/tasks'
import { tagsRouter } from './routes/tags'
import { attachmentsRouter } from './routes/attachments'

const app = new Hono()

app.use('*', cors())

app.get('/api/health', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }))

app.get('/api/config', (c) => {
  const dbUrl = process.env.DATABASE_URL || ''
  const match = dbUrl.match(/postgresql:\/\/postgres\.([^.]+)\./)
  const projectRef = match ? match[1] : ''
  return c.json({
    supabaseUrl: `https://${projectRef}.supabase.co`,
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY || '',
  })
})

app.route('/api/projects', projectsRouter)
app.route('/api/projects', columnsRouter)
app.route('/api/projects', tasksRouter)
app.route('/api/tags', tagsRouter)
app.route('/api/tasks', attachmentsRouter)

const port = Number(process.env.PORT) || 8787
console.log(`Server starting on http://localhost:${port}`)
serve({ fetch: app.fetch, port })
