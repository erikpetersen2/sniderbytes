import { useAuth } from '../auth/AuthContext'
import type { ReactNode } from 'react'

export default function ProtectedRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth()
  if (isLoading) return null
  // If not authenticated authservice will redirect to Keycloak; render nothing in the meantime
  if (!isAuthenticated) return null
  return <>{children}</>
}
