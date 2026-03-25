import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './auth/AuthContext'
import ProtectedRoute from './routes/ProtectedRoute'
import AdminRoute from './routes/AdminRoute'
import Layout from './components/Layout'
import LoginPage from './pages/LoginPage'
import OverviewPage from './pages/OverviewPage'
import AlertsPage from './pages/AlertsPage'
import UsersPage from './pages/UsersPage'

function RedirectToFirstCluster() {
  return <Navigate to="/" replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Layout>
                  <div className="p-6">
                    <p className="text-ops-muted">Select a cluster from the sidebar to get started.</p>
                  </div>
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/clusters/:id/overview"
            element={
              <ProtectedRoute>
                <Layout>
                  <OverviewPage />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/clusters/:id/alerts"
            element={
              <ProtectedRoute>
                <Layout>
                  <AlertsPage />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/users"
            element={
              <AdminRoute>
                <Layout>
                  <UsersPage />
                </Layout>
              </AdminRoute>
            }
          />
          <Route path="*" element={<RedirectToFirstCluster />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
