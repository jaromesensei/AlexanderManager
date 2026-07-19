// טיפוסי בסיס הנתונים. בפאזה 0 מוגדרות רק טבלאות הליבה (profiles).
// טבלאות המודולים (חשבוניות, סידור) יתווספו בפאזות הבאות.
// בהמשך אפשר לייצר קובץ זה אוטומטית עם `supabase gen types typescript`.

export type UserRole = 'manager' | 'employee'

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          full_name: string | null
          role: UserRole
          created_at: string
        }
        Insert: {
          id: string
          full_name?: string | null
          role?: UserRole
          created_at?: string
        }
        Update: {
          id?: string
          full_name?: string | null
          role?: UserRole
          created_at?: string
        }
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: {
      user_role: UserRole
    }
  }
}
