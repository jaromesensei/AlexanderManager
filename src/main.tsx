import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import App from './App'
import './index.css'

// רישום Service Worker עם התראה גלויה כשיש גרסה חדשה + בדיקה תקופתית.
const updateSW = registerSW({
  onNeedRefresh() {
    showUpdateBanner(() => updateSW(true))
  },
  onRegisteredSW(_swUrl, registration) {
    if (registration) {
      // בדיקת עדכון כל דקה, וגם כשחוזרים לאפליקציה
      setInterval(() => registration.update().catch(() => {}), 60_000)
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') registration.update().catch(() => {})
      })
    }
  },
})

function showUpdateBanner(onRefresh: () => void) {
  if (document.getElementById('pwa-update-banner')) return
  const bar = document.createElement('div')
  bar.id = 'pwa-update-banner'
  bar.dir = 'rtl'
  bar.style.cssText =
    'position:fixed;left:12px;right:12px;bottom:12px;z-index:9999;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 16px;border-radius:16px;background:#4338ca;color:#fff;font-family:inherit;box-shadow:0 6px 24px rgba(0,0,0,.25)'
  const txt = document.createElement('span')
  txt.textContent = 'גרסה חדשה זמינה'
  txt.style.cssText = 'font-size:14px;font-weight:600'
  const btn = document.createElement('button')
  btn.textContent = 'רענן'
  btn.style.cssText =
    'background:#fff;color:#4338ca;border:none;border-radius:10px;padding:8px 18px;font-weight:700;font-size:14px;cursor:pointer'
  btn.onclick = () => {
    bar.remove()
    onRefresh()
  }
  bar.appendChild(txt)
  bar.appendChild(btn)
  document.body.appendChild(bar)
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
