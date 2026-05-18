import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema.js'
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

    const client = postgres(connectionString, { max: 10 })
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
