import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from '@/lib/queryClient'
import { AuthProvider } from '@/contexts/AuthContext'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { AppShell } from '@/components/layout/AppShell'
import { Login } from '@/pages/Login'
import { Home } from '@/pages/Home'
import { Invoices } from '@/pages/Invoices'
import { InvoiceForm } from '@/pages/InvoiceForm'
import { InvoiceDetail } from '@/pages/InvoiceDetail'
import { Suppliers } from '@/pages/Suppliers'
import { Schedule } from '@/pages/Schedule'
import { Employees } from '@/pages/Employees'

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />

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
              <Route path="/schedule" element={<Schedule />} />
              <Route
                path="/employees"
                element={
                  <ProtectedRoute managerOnly>
                    <Employees />
                  </ProtectedRoute>
                }
              />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  )
}
