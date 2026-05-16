import { createClient } from '@supabase/supabase-js'

let _supabase: ReturnType<typeof createClient> | null = null

export async function getSupabase() {
  if (_supabase) return _supabase
  const res = await fetch('/api/config')
  const { supabaseUrl, supabaseAnonKey } = await res.json()
  _supabase = createClient(supabaseUrl, supabaseAnonKey)
  return _supabase
}
