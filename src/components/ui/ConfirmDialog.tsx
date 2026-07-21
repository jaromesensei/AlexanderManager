import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { Button } from './Button'

interface ConfirmOptions {
  title: string
  message?: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
}

type ConfirmFn = (opts: ConfirmOptions) => Promise<boolean>

const ConfirmContext = createContext<ConfirmFn | null>(null)

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext)
  if (!ctx) throw new Error('useConfirm חייב להיות בתוך ConfirmProvider')
  return ctx
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [opts, setOpts] = useState<ConfirmOptions | null>(null)
  const resolver = useRef<((v: boolean) => void) | null>(null)

  const confirm = useCallback<ConfirmFn>((o) => {
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve
      setOpts(o)
    })
  }, [])

  const close = useCallback((v: boolean) => {
    resolver.current?.(v)
    resolver.current = null
    setOpts(null)
  }, [])

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {opts && (
        <Dialog opts={opts} onCancel={() => close(false)} onConfirm={() => close(true)} />
      )}
    </ConfirmContext.Provider>
  )
}

function Dialog({
  opts,
  onCancel,
  onConfirm,
}: {
  opts: ConfirmOptions
  onCancel: () => void
  onConfirm: () => void
}) {
  const confirmRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    confirmRef.current?.focus()
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onCancel()
      if (e.key === 'Enter') onConfirm()
    }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [onCancel, onConfirm])

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-black/50 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onCancel}
      role="presentation"
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-label={opts.title}
        onClick={(e) => e.stopPropagation()}
        className="animate-rise w-full max-w-sm rounded-t-3xl border border-neutral-800 bg-neutral-900 p-5 pb-6 shadow-2xl sm:rounded-2xl"
      >
        <h2 className="text-lg font-bold text-neutral-100">{opts.title}</h2>
        {opts.message && (
          <p className="mt-1.5 text-sm leading-relaxed text-neutral-400">
            {opts.message}
          </p>
        )}
        <div className="mt-5 flex gap-2">
          <Button variant="secondary" onClick={onCancel} className="flex-1">
            {opts.cancelLabel ?? 'ביטול'}
          </Button>
          <Button
            ref={confirmRef}
            variant={opts.danger ? 'danger' : 'primary'}
            onClick={onConfirm}
            className="flex-1"
          >
            {opts.confirmLabel ?? 'אישור'}
          </Button>
        </div>
      </div>
    </div>
  )
}
