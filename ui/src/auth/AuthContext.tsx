import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import * as api from '../api/client'
import type { User } from '../types'

// /globallogout is the authservice logout path for this chain — it clears
// the authservice session cookie then redirects to Keycloak's logout endpoint.
const LOGOUT_URL = '/globallogout'

interface AuthState {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (username: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    api.me()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setIsLoading(false))
  }, [])

  const login = useCallback(async (username: string, password: string) => {
    const res = await api.login(username, password)
    localStorage.setItem('token', res.token)
    setUser(res.user)
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('token')
    // Redirect to Keycloak logout so SSO sessions are also cleared
    window.location.href = LOGOUT_URL
  }, [])

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
