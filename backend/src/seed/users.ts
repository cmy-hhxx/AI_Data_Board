import { config } from 'dotenv'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
config({ path: resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '.env') })

import { getDb } from '../db'
import { users } from '../db/schema'

const db = getDb()

const seedUsers = [
  { name: '杨钰邦', role: 'supervisor' as const },
  { name: '吴浩威', role: 'pm' as const },
  { name: '陈明扬', role: 'algorithm' as const },
  { name: '姜淞译', role: 'algorithm' as const },
  { name: '任理想', role: 'annotator' as const },
  { name: '胡俊峰', role: 'crawler' as const },
  { name: '朱宇晨', role: 'intern' as const },
]

async function main() {
  console.log('📝 开始录入初始用户...')
  const result = await db.insert(users).values(seedUsers).returning()
  console.log(`✅ 成功录入 ${result.length} 条用户记录:`)
  for (const user of result) {
    console.log(`   ${user.name} (${user.role}) — ${user.id}`)
  }
}

main().catch((err) => {
  console.error('❌ 种子数据录入失败:', err)
  process.exit(1)
})
