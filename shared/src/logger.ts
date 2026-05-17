// ---------------------------------------------------------------------------
// AI Data Board — 跨平台日志模块
// ---------------------------------------------------------------------------
// 级别 (从低到高): debug / info / warn / error
//
// 后端 (Node/tsx): 环境变量 VERBOSE=true 时自动开启 debug 级别
// 前端 (Vite):     始终默认 info 级别（浏览器可通过 setLogLevel 切换）
// ---------------------------------------------------------------------------

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

// ANSI 颜色 — 仅终端环境有效（浏览器会自动忽略转义码）
const RESET = '\x1b[0m'
const PREFIX: Record<LogLevel, string> = {
  debug: '\x1b[90m[D]',   // 灰色
  info:  '\x1b[36m[I]',   // 青色
  warn:  '\x1b[33m[W]',   // 黄色
  error: '\x1b[31m[E]',   // 红色
}

const LEVEL_RANK: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 }

// ---------------------------------------------------------------------------
// 当前有效级别 — 延迟初始化以避免浏览器解析 process.env 报错
// ---------------------------------------------------------------------------
let _level: LogLevel | null = null

function getLevel(): LogLevel {
  if (_level === null) {
    // 仅在 Node 环境下读取 process.env
    if (typeof process !== 'undefined' && process.env) {
      _level = (process.env.VERBOSE === 'true' || process.env.VERBOSE === '1')
        ? 'debug'
        : 'info'
    } else {
      _level = 'info'
    }
  }
  return _level
}

export function setLogLevel(level: LogLevel) {
  _level = level
}

export function getLogLevel(): LogLevel {
  return getLevel()
}

// ---------------------------------------------------------------------------
// 内部格式化
// ---------------------------------------------------------------------------
function timestamp(): string {
  return new Date().toISOString().slice(11, 23) // HH:MM:SS.mmm
}

function formatArgs(args: unknown[]): string {
  return args.length > 0
    ? ' ' + args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ')
    : ''
}

function write(level: LogLevel, tag: string, message: string, args: unknown[]) {
  if (LEVEL_RANK[level] < LEVEL_RANK[getLevel()]) return

  const prefix = PREFIX[level]
  const ts = timestamp()
  const extra = formatArgs(args)
  const line = `${prefix} [${ts}] [${tag}] ${message}${extra}${RESET}`

  if (level === 'error') {
    console.error(line)
  } else if (level === 'warn') {
    console.warn(line)
  } else {
    console.log(line)
  }
}

// ---------------------------------------------------------------------------
// 公开 API
// ---------------------------------------------------------------------------
export const logger = {
  debug(tag: string, message: string, ...args: unknown[]) {
    write('debug', tag, message, args)
  },
  info(tag: string, message: string, ...args: unknown[]) {
    write('info', tag, message, args)
  },
  warn(tag: string, message: string, ...args: unknown[]) {
    write('warn', tag, message, args)
  },
  error(tag: string, message: string, ...args: unknown[]) {
    write('error', tag, message, args)
  },
}
