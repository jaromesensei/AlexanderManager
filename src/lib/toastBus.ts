// גשר קטן שמאפשר לקוד מחוץ ל-React (כמו queryClient) לפלוט הודעות Toast.
// ה-ToastProvider רושם כאן את ה-API שלו בעת טעינה.

type ToastType = 'success' | 'error' | 'info'
type Emit = (type: ToastType, message: string) => void

let emit: Emit | null = null

export function registerToast(fn: Emit | null) {
  emit = fn
}

export function toastBus(type: ToastType, message: string) {
  emit?.(type, message)
}
