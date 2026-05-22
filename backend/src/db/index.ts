import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'
import { logger } from '@ai-data-board/shared'

const TAG = 'DB'

let _db: ReturnType<typeof drizzle> | null = null

export function getDb() {
  if (!_db) {
    const connectionString = process.env.DATABASE_URL
    if (!connectionString) {
      logger.error(TAG, 'DATABASE_URL 未设置')
      throw new Error('DATABASE_URL is not set. Check your .env file.')
    }

    // 从连接串提取 project ref（不打印完整 URL 以防泄露）
    const projectRef = connectionString.match(/postgres\.([^:@]+)/)?.[1] || '<unknown>'
    logger.info(TAG, '初始化数据库连接', { projectRef, maxConnections: 10 })

    const client = postgres(connectionString, {
      max: 5,
      idle_timeout: 20,      // close idle connections after 20s to prevent server-side drops
      connect_timeout: 30,   // 30s to establish a connection
      max_lifetime: 1800,    // recycle connections every 30 minutes
      prepare: false,        // disable prepared statements for PgBouncer compatibility
    })
    _db = drizzle(client, { schema })
    logger.info(TAG, '数据库连接就绪')
  }
  return _db
}

export const db = new Proxy({} as ReturnType<typeof drizzle>, {
  get(_, prop) {
    logger.debug(TAG, `延迟访问数据库属性: ${String(prop)}`)
    return (getDb() as any)[prop]
  },
})
