import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'חסרים משתני סביבה של Supabase. ודא ש-VITE_SUPABASE_URL ו-VITE_SUPABASE_ANON_KEY מוגדרים ב-.env.local'
  )
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})

/**
 * מחזיר access token תקף לקריאות ל-Edge Functions. אם הטוקן פג או קרוב
 * לפוג — מרענן אותו יזומה (מונע 401 "לא מחובר").
 */
export async function freshAccessToken(): Promise<string | undefined> {
  const { data } = await supabase.auth.getSession()
  const session = data.session
  if (!session) return undefined
  const expMs = (session.expires_at ?? 0) * 1000
  if (expMs && expMs < Date.now() + 60_000) {
    const { data: refreshed } = await supabase.auth.refreshSession()
    return refreshed.session?.access_token ?? session.access_token
  }
  return session.access_token
}
