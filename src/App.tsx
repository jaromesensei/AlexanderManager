import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from '@/lib/queryClient'
import { AuthProvider } from '@/contexts/AuthContext'
import { ToastProvider } from '@/components/ui/Toast'
import { ConfirmProvider } from '@/components/ui/ConfirmDialog'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { AppShell } from '@/components/layout/AppShell'
import { FullScreenSpinner } from '@/components/ui/Spinner'
import { Login } from '@/pages/Login'
import { Home } from '@/pages/Home'

// טעינה עצלה (code-splitting) — כל מסך נטען רק כשנכנסים אליו, לטעינה ראשונית מהירה.
const lazyPage = <T extends Record<string, React.ComponentType>>(
  loader: () => Promise<T>,
  key: keyof T
) => lazy(() => loader().then((m) => ({ default: m[key] })))

const Invoices = lazyPage(() => import('@/pages/Invoices'), 'Invoices')
const InvoiceForm = lazyPage(() => import('@/pages/InvoiceForm'), 'InvoiceForm')
const InvoiceDetail = lazyPage(() => import('@/pages/InvoiceDetail'), 'InvoiceDetail')
const Suppliers = lazyPage(() => import('@/pages/Suppliers'), 'Suppliers')
const Products = lazyPage(() => import('@/pages/Products'), 'Products')
const Dishes = lazyPage(() => import('@/pages/Dishes'), 'Dishes')
const Reports = lazyPage(() => import('@/pages/Reports'), 'Reports')
const Orders = lazyPage(() => import('@/pages/Orders'), 'Orders')
const OrderForm = lazyPage(() => import('@/pages/OrderForm'), 'OrderForm')
const OrderReceive = lazyPage(() => import('@/pages/OrderReceive'), 'OrderReceive')
const Tips = lazyPage(() => import('@/pages/Tips'), 'Tips')
const TipsDayClose = lazyPage(() => import('@/pages/TipsDayClose'), 'TipsDayClose')
const TipsReport = lazyPage(() => import('@/pages/TipsReport'), 'TipsReport')
const TipsReportPrint = lazyPage(
  () => import('@/pages/TipsReportPrint'),
  'TipsReportPrint'
)
const AssistantLog = lazyPage(() => import('@/pages/AssistantLog'), 'AssistantLog')
const Schedule = lazyPage(() => import('@/pages/Schedule'), 'Schedule')
const Employees = lazyPage(() => import('@/pages/Employees'), 'Employees')
const Requirements = lazyPage(() => import('@/pages/Requirements'), 'Requirements')
const SendSchedule = lazyPage(() => import('@/pages/SendSchedule'), 'SendSchedule')
const RequestAvailability = lazyPage(
  () => import('@/pages/RequestAvailability'),
  'RequestAvailability'
)
const SchedulePrint = lazyPage(() => import('@/pages/SchedulePrint'), 'SchedulePrint')
const AvailabilityPublic = lazyPage(
  () => import('@/pages/AvailabilityPublic'),
  'AvailabilityPublic'
)
const AvailabilityGroup = lazyPage(
  () => import('@/pages/AvailabilityGroup'),
  'AvailabilityGroup'
)

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ToastProvider>
          <ConfirmProvider>
            <BrowserRouter>
              <Suspense fallback={<FullScreenSpinner />}>
                <Routes>
                  <Route path="/login" element={<Login />} />
                  <Route path="/availability" element={<AvailabilityGroup />} />
                  <Route path="/availability/:token" element={<AvailabilityPublic />} />
                  <Route
                    path="/schedule/print/:from"
                    element={
                      <ProtectedRoute managerOnly>
                        <SchedulePrint />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/tips/report/print/:month"
                    element={
                      <ProtectedRoute managerOnly>
                        <TipsReportPrint />
                      </ProtectedRoute>
                    }
                  />

                  <Route
                    element={
                      <ProtectedRoute>
                        <AppShell />
                      </ProtectedRoute>
                    }
                  >
                    <Route path="/" element={<Home />} />
                    <Route
                      path="/invoices"
                      element={
                        <ProtectedRoute managerOnly>
                          <Invoices />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/invoices/new"
                      element={
                        <ProtectedRoute managerOnly>
                          <InvoiceForm />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/invoices/:id"
                      element={
                        <ProtectedRoute managerOnly>
                          <InvoiceDetail />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/invoices/:id/edit"
                      element={
                        <ProtectedRoute managerOnly>
                          <InvoiceForm />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/suppliers"
                      element={
                        <ProtectedRoute managerOnly>
                          <Suppliers />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/products"
                      element={
                        <ProtectedRoute managerOnly>
                          <Products />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/dishes"
                      element={
                        <ProtectedRoute managerOnly>
                          <Dishes />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/reports"
                      element={
                        <ProtectedRoute managerOnly>
                          <Reports />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/orders"
                      element={
                        <ProtectedRoute managerOnly>
                          <Orders />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/orders/new"
                      element={
                        <ProtectedRoute managerOnly>
                          <OrderForm />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/orders/:id/edit"
                      element={
                        <ProtectedRoute managerOnly>
                          <OrderForm />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/orders/:id/receive"
                      element={
                        <ProtectedRoute managerOnly>
                          <OrderReceive />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/tips"
                      element={
                        <ProtectedRoute managerOnly>
                          <Tips />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/tips/close"
                      element={
                        <ProtectedRoute managerOnly>
                          <TipsDayClose />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/tips/report"
                      element={
                        <ProtectedRoute managerOnly>
                          <TipsReport />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/assistant/log"
                      element={
                        <ProtectedRoute managerOnly>
                          <AssistantLog />
                        </ProtectedRoute>
                      }
                    />
                    <Route path="/schedule" element={<Schedule />} />
                    <Route
                      path="/employees"
                      element={
                        <ProtectedRoute managerOnly>
                          <Employees />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/requirements"
                      element={
                        <ProtectedRoute managerOnly>
                          <Requirements />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/schedule/send/:from"
                      element={
                        <ProtectedRoute managerOnly>
                          <SendSchedule />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/schedule/request/:from"
                      element={
                        <ProtectedRoute managerOnly>
                          <RequestAvailability />
                        </ProtectedRoute>
                      }
                    />
                  </Route>

                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </Suspense>
            </BrowserRouter>
          </ConfirmProvider>
        </ToastProvider>
      </AuthProvider>
    </QueryClientProvider>
  )
}
