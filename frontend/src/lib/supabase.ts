import { createClient } from '@supabase/supabase-js'

let _supabase: ReturnType<typeof createClient> | null = null
let _disabled = false

export async function getSupabase() {
  if (_disabled) return null
  if (_supabase) return _supabase
  const res = await fetch('/api/config')
  const { supabaseUrl, supabaseAnonKey, realtimeEnabled } = await res.json()
  if (!realtimeEnabled || !supabaseUrl || !supabaseAnonKey) {
    _disabled = true
    return null
  }
  _supabase = createClient(supabaseUrl, supabaseAnonKey)
  return _supabase
}
