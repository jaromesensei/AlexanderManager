import { Link } from 'react-router-dom'
import { Receipt, CalendarDays, ChevronLeft } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { Card } from '@/components/ui/Card'

export function Home() {
  const { profile, isManager } = useAuth()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">
          שלום{profile?.full_name ? `, ${profile.full_name}` : ''} 👋
        </h1>
        <p className="mt-1 text-neutral-400">
          {isManager ? 'לוח הבקרה של המסעדה' : 'סידור העבודה שלך'}
        </p>
      </div>

      <div className="space-y-3">
        {isManager && (
          <Link to="/invoices">
            <Card className="flex items-center justify-between transition-colors hover:border-brand-700">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-brand-950 p-3">
                  <Receipt className="h-6 w-6 text-brand-500" />
                </div>
                <div>
                  <h2 className="font-semibold">חשבוניות ופוד קוסט</h2>
                  <p className="text-sm text-neutral-400">מחירים, עלויות ודוחות</p>
                </div>
              </div>
              <ChevronLeft className="h-5 w-5 text-neutral-500" />
            </Card>
          </Link>
        )}

        <Link to="/schedule">
          <Card className="flex items-center justify-between transition-colors hover:border-brand-700">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-brand-950 p-3">
                <CalendarDays className="h-6 w-6 text-brand-500" />
              </div>
              <div>
                <h2 className="font-semibold">סידורי עבודה</h2>
                <p className="text-sm text-neutral-400">משמרות ואיוש עמדות</p>
              </div>
            </div>
            <ChevronLeft className="h-5 w-5 text-neutral-500" />
          </Card>
        </Link>
      </div>
    </div>
  )
}
