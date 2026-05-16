import { config } from 'dotenv'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
config({ path: resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '.env') })

import postgres from 'postgres'

const sql = postgres(process.env.DATABASE_URL!, { max: 1 })

const tables = ['projects', 'board_columns', 'tasks', 'tags', 'task_tags', 'attachments']

async function main() {
  for (const table of tables) {
    try {
      await sql.unsafe(`ALTER PUBLICATION supabase_realtime ADD TABLE "${table}"`)
      console.log(`✅ Added ${table} to supabase_realtime`)
    } catch (e: any) {
      if (e.message?.includes('already a member')) {
        console.log(`⏭️  ${table} already in supabase_realtime`)
      } else {
        console.error(`❌ ${table}:`, e.message)
      }
    }
    try {
      await sql.unsafe(`ALTER TABLE "${table}" REPLICA IDENTITY FULL`)
      console.log(`✅ Set REPLICA IDENTITY FULL on ${table}`)
    } catch (e: any) {
      console.error(`❌ ${table} REPLICA:`, e.message)
    }
  }
  await sql.end()
}

main()
