import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { CheckCircle2, XCircle, Info, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { registerToast } from '@/lib/toastBus'
import { hapticSuccess, hapticError } from '@/lib/haptics'

type ToastType = 'success' | 'error' | 'info'

interface Toast {
  id: number
  type: ToastType
  message: string
}

interface ToastApi {
  success: (message: string) => void
  error: (message: string) => void
  info: (message: string) => void
}

const ToastContext = createContext<ToastApi | null>(null)

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast חייב להיות בתוך ToastProvider')
  return ctx
}

const STYLES: Record<ToastType, { icon: typeof CheckCircle2; cls: string }> = {
  success: { icon: CheckCircle2, cls: 'border-green-800 bg-green-950 text-green-200' },
  error: { icon: XCircle, cls: 'border-red-800 bg-red-950 text-red-200' },
  info: { icon: Info, cls: 'border-neutral-700 bg-neutral-900 text-neutral-200' },
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const nextId = useRef(1)

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const push = useCallback(
    (type: ToastType, message: string) => {
      const id = nextId.current++
      setToasts((prev) => [...prev, { id, type, message }])
      if (type === 'success') hapticSuccess()
      else if (type === 'error') hapticError()
      window.setTimeout(() => dismiss(id), 3500)
    },
    [dismiss]
  )

  const api = useMemo<ToastApi>(
    () => ({
      success: (m) => push('success', m),
      error: (m) => push('error', m),
      info: (m) => push('info', m),
    }),
    [push]
  )

  // מאפשר לקוד מחוץ ל-React (queryClient) לפלוט הודעות דרך אותו viewport
  useEffect(() => {
    registerToast((type, message) => push(type, message))
    return () => registerToast(null)
  }, [push])

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex flex-col items-center gap-2 px-4 pb-24">
        {toasts.map((t) => {
          const { icon: Icon, cls } = STYLES[t.type]
          return (
            <button
              key={t.id}
              onClick={() => dismiss(t.id)}
              className={cn(
                'pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-2xl border px-4 py-3 text-right shadow-lg',
                'animate-[toast-in_0.2s_ease-out]',
                cls
              )}
            >
              <Icon className="h-5 w-5 shrink-0" />
              <span className="flex-1 text-sm font-medium">{t.message}</span>
              <X className="h-4 w-4 shrink-0 opacity-60" />
            </button>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}
