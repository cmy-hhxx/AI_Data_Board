import type { MiddlewareHandler } from 'hono'
import { logger, getLogLevel } from '@ai-data-board/shared'

const TAG = 'HTTP'

/**
 * 请求日志中间件 — 记录每个 API 请求的方法、路径、状态码和耗时
 * 在 debug 级别记录完整信息，info 级别仅摘要
 */
export const requestLogger: MiddlewareHandler = async (c, next) => {
  const method = c.req.method
  const path = c.req.path
  const start = Date.now()

  logger.debug(TAG, `→ ${method} ${path}`)

  await next()

  const elapsed = Date.now() - start
  const status = c.res.status

  // 错误请求（4xx/5xx）总是记录
  if (status >= 500) {
    logger.error(TAG, `← ${method} ${path} ${status} ${elapsed}ms`)
  } else if (status >= 400) {
    logger.warn(TAG, `← ${method} ${path} ${status} ${elapsed}ms`)
  } else if (getLogLevel() === 'debug') {
    // verbose 模式下记录所有请求
    logger.debug(TAG, `← ${method} ${path} ${status} ${elapsed}ms`)
  }
}
