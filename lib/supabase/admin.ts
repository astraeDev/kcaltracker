import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/database.types'

// ⚠️ Ne jamais importer ce fichier dans un composant client ('use client')
// ⚠️ SUPABASE_SERVICE_ROLE_KEY ne doit JAMAIS avoir le préfixe NEXT_PUBLIC_
export function createAdminClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}