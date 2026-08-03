import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { toastBus } from '@/lib/toastBus'

// snapshot של יום טיפים לצורך שחזור
export interface TipSnapshot {
  total_tips: number
  notes: string | null
  entries: {
    employee_id: string
    hours: number
    start_time: string | null
    end_time: string | null
  }[]
}

export interface ActionRow {
  id: string
  action_type: string
  work_date: string | null
  description: string
  prev_state: TipSnapshot | null
  undone: boolean
  created_at: string
}

export const ACTIONS_KEY = ['assistant_actions']

/** רושם פעולה ביומן ומחזיר את מזהה השורה. */
export async function logTipAction(params: {
  work_date: string
  description: string
  prev: TipSnapshot | null
}): Promise<ActionRow> {
  const { data, error } = await supabase
    .from('assistant_actions')
    .insert({
      action_type: 'close_tip_day',
      work_date: params.work_date,
      description: params.description,
      prev_state: params.prev,
    } as never)
    .select('*')
    .single()
  if (error) throw error
  return data as unknown as ActionRow
}

async function restoreTipDay(date: string, snap: TipSnapshot) {
  const { data, error } = await supabase
    .from('tip_days')
    .upsert(
      { work_date: date, total_tips: snap.total_tips, notes: snap.notes } as never,
      { onConflict: 'work_date' }
    )
    .select('id')
    .single()
  if (error) throw error
  const id = (data as { id: string }).id
  await supabase.from('tip_day_entries').delete().eq('tip_day_id', id)
  const rows = snap.entries.map((e, i) => ({
    tip_day_id: id,
    employee_id: e.employee_id,
    hours: e.hours,
    start_time: e.start_time,
    end_time: e.end_time,
    position: i,
  }))
  if (rows.length > 0) {
    const { error: insErr } = await supabase.from('tip_day_entries').insert(rows as never)
    if (insErr) throw insErr
  }
}

async function deleteTipDayByDate(date: string) {
  const { error } = await supabase.from('tip_days').delete().eq('work_date', date)
  if (error) throw error
}

/** מבטל פעולה: משחזר את המצב הקודם (או מוחק אם לא היה קיים) ומסמן undone. */
export async function reverseAndMark(a: ActionRow): Promise<void> {
  if (a.action_type === 'close_tip_day' && a.work_date) {
    if (a.prev_state) await restoreTipDay(a.work_date, a.prev_state)
    else await deleteTipDayByDate(a.work_date)
  }
  const { error } = await supabase
    .from('assistant_actions')
    .update({ undone: true } as never)
    .eq('id', a.id)
  if (error) throw error
}

export function useActionLog() {
  return useQuery({
    queryKey: ACTIONS_KEY,
    queryFn: async (): Promise<ActionRow[]> => {
      const { data, error } = await supabase
        .from('assistant_actions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50)
      if (error) throw error
      return (data ?? []) as unknown as ActionRow[]
    },
  })
}

export function useUndoAction() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (a: ActionRow) => reverseAndMark(a),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ACTIONS_KEY })
      qc.invalidateQueries({ queryKey: ['tip_days'] })
      qc.invalidateQueries({ queryKey: ['tip_day'] })
      qc.invalidateQueries({ queryKey: ['tip_report'] })
      toastBus('success', 'הפעולה בוטלה')
    },
  })
}
