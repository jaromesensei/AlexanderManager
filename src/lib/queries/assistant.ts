import { supabase } from '@/lib/supabase'

export interface AssistantEntry {
  employee_id: string
  employee_name: string
  start: string // "HH:MM"
  end: string // "HH:MM"
}

export interface AssistantProposal {
  kind: 'close_tip_day'
  work_date: string
  total_tips: number | null // בשקלים
  per_hour: number | null // בשקלים
  entries: AssistantEntry[]
  note: string | null
}

export interface AssistantMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface AssistantContext {
  today: string
  weekday: string
  min_hourly_wage_agorot: number
  employees: { id: string; name: string }[]
  recent_days: unknown[]
}

export interface AssistantReply {
  reply: string
  proposals: AssistantProposal[]
}

/** שולח שיחה + הקשר לאלכס ומחזיר תשובה + הצעות. imagePath — צילום אופציונלי. */
export async function askAssistant(
  messages: AssistantMessage[],
  context: AssistantContext,
  imagePath?: string
): Promise<AssistantReply> {
  // ריענון ה-session (מרענן טוקן שפג) והעברת טוקן טרי בכותרת
  const { data: sess } = await supabase.auth.getSession()
  const token = sess.session?.access_token
  const { data, error } = await supabase.functions.invoke('assistant', {
    body: { messages, context, image_path: imagePath ?? null },
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  })
  if (error) {
    const ctx = (error as { context?: Response }).context
    if (ctx && typeof ctx.text === 'function') {
      const raw = await ctx.text().catch(() => '')
      if (raw) {
        let msg: string = raw
        try {
          msg = JSON.parse(raw)?.error ?? raw
        } catch {
          // גוף לא-JSON
        }
        throw new Error(`(${ctx.status}) ${String(msg).slice(0, 300)}`)
      }
    }
    throw new Error(error.message)
  }
  if (data?.error) throw new Error(data.error)
  return {
    reply: data.reply ?? '',
    proposals: Array.isArray(data.proposals) ? data.proposals : [],
  }
}
