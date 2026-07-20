import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  Receipt,
  CalendarDays,
  ChevronLeft,
  TrendingUp,
  AlertTriangle,
  FileText,
  CheckCircle2,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useOpenAlerts } from '@/lib/queries/alerts'
import { useInvoices } from '@/lib/queries/invoices'
import { useRequirements } from '@/lib/queries/requirements'
import { useShifts } from '@/lib/queries/shifts'
import { startOfWeek, addDays, toISODate, SHIFTS, STAFF_ROLES } from '@/lib/scheduling'
import type { ShiftType, StaffRole } from '@/types/database'
import { cn } from '@/lib/utils'
import { Card } from '@/components/ui/Card'
import { APP_VERSION } from '@/version'

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

      {isManager && <ManagerDashboard />}

      <div className="space-y-3">
        {isManager && (
          <ModuleTile
            to="/invoices"
            icon={Receipt}
            title="חשבוניות ופוד קוסט"
            subtitle="מחירים, עלויות ודוחות"
          />
        )}
        <ModuleTile
          to="/schedule"
          icon={CalendarDays}
          title="סידורי עבודה"
          subtitle="משמרות ואיוש עמדות"
        />
      </div>

      <p className="pt-2 text-center text-xs text-neutral-600">גרסה {APP_VERSION}</p>
    </div>
  )
}

function ManagerDashboard() {
  const { data: alerts } = useOpenAlerts()
  const { data: invoices } = useInvoices()
  const { data: reqs } = useRequirements()

  const weekStart = useMemo(() => startOfWeek(new Date()), [])
  const from = toISODate(weekStart)
  const to = toISODate(addDays(weekStart, 6))
  const { data: shifts } = useShifts(from, to)

  const alertCount = alerts?.length ?? 0
  const draftCount = invoices?.filter((i) => i.status === 'pending').length ?? 0

  // חוסרי איוש השבוע = סך העמדות החסרות מול הדרישות
  const gaps = useMemo(() => {
    if (!reqs) return 0
    const defaults: Record<ShiftType, Partial<Record<StaffRole, number>>> = {
      morning: {},
      evening: {},
    }
    const overrides: Record<number, Record<ShiftType, Partial<Record<StaffRole, number>>>> =
      {}
    for (const r of reqs) {
      if (r.weekday == null) defaults[r.shift][r.role] = r.required_count
      else {
        overrides[r.weekday] ??= { morning: {}, evening: {} }
        overrides[r.weekday][r.shift][r.role] = r.required_count
      }
    }
    let missing = 0
    for (let i = 0; i < 7; i++) {
      const iso = toISODate(addDays(weekStart, i))
      const req = overrides[i] ?? defaults
      for (const shift of SHIFTS) {
        for (const role of STAFF_ROLES) {
          const need = req[shift][role] ?? 0
          if (need === 0) continue
          const have = (shifts ?? []).filter(
            (s) => s.work_date === iso && s.shift === shift && s.role === role
          ).length
          missing += Math.max(0, need - have)
        }
      }
    }
    return missing
  }, [reqs, shifts, weekStart])

  const allClear = alertCount === 0 && gaps === 0 && draftCount === 0

  if (allClear) {
    return (
      <Card className="flex items-center gap-3 border-green-900 bg-green-950/20">
        <CheckCircle2 className="h-6 w-6 shrink-0 text-green-400" />
        <p className="text-green-200">הכל מסודר — אין התראות פתוחות 👌</p>
      </Card>
    )
  }

  return (
    <div className="space-y-2">
      <p className="px-1 text-sm font-semibold text-neutral-300">דורש תשומת לב</p>
      {alertCount > 0 && (
        <StatCard
          to="/invoices"
          icon={TrendingUp}
          color="red"
          title={`${alertCount} התראות מחיר`}
          subtitle="מוצרים שהתייקרו"
        />
      )}
      {gaps > 0 && (
        <StatCard
          to="/schedule"
          icon={AlertTriangle}
          color="amber"
          title={`${gaps} עמדות חסרות השבוע`}
          subtitle="חוסרי איוש בסידור"
        />
      )}
      {draftCount > 0 && (
        <StatCard
          to="/invoices"
          icon={FileText}
          color="neutral"
          title={`${draftCount} חשבוניות טיוטה`}
          subtitle="ממתינות לאישור"
        />
      )}
    </div>
  )
}

const COLORS = {
  red: 'border-red-900 bg-red-950/20 text-red-400',
  amber: 'border-amber-900 bg-amber-950/20 text-amber-400',
  neutral: 'border-neutral-800 bg-neutral-900 text-neutral-400',
}

function StatCard({
  to,
  icon: Icon,
  color,
  title,
  subtitle,
}: {
  to: string
  icon: typeof TrendingUp
  color: keyof typeof COLORS
  title: string
  subtitle: string
}) {
  return (
    <Link to={to}>
      <div
        className={cn(
          'flex items-center justify-between rounded-2xl border p-4',
          COLORS[color]
        )}
      >
        <div className="flex items-center gap-3">
          <Icon className="h-6 w-6 shrink-0" />
          <div>
            <p className="font-semibold text-neutral-100">{title}</p>
            <p className="text-sm">{subtitle}</p>
          </div>
        </div>
        <ChevronLeft className="h-5 w-5 text-neutral-500" />
      </div>
    </Link>
  )
}

function ModuleTile({
  to,
  icon: Icon,
  title,
  subtitle,
}: {
  to: string
  icon: typeof Receipt
  title: string
  subtitle: string
}) {
  return (
    <Link to={to}>
      <Card className="flex items-center justify-between transition-colors hover:border-brand-700">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-brand-950 p-3">
            <Icon className="h-6 w-6 text-brand-500" />
          </div>
          <div>
            <h2 className="font-semibold">{title}</h2>
            <p className="text-sm text-neutral-400">{subtitle}</p>
          </div>
        </div>
        <ChevronLeft className="h-5 w-5 text-neutral-500" />
      </Card>
    </Link>
  )
}
