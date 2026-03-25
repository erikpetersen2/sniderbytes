import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import * as api from '../api/client'
import type { User } from '../types'

interface AuthState {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  login: (username: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthState | null>(null)

function decodeJWT(token: string): User | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    return { id: payload.user_id, username: payload.username ?? '', role: payload.role }
  } catch {
    return null
  }
}

function restoreUser(token: string | null): User | null {
  if (!token) return null
  // Decode claims; username not in JWT so we supplement from storage
  const decoded = decodeJWT(token)
  const storedUsername = localStorage.getItem('username')
  if (decoded && storedUsername) decoded.username = storedUsername
  return decoded
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('token'))
  const [user, setUser] = useState<User | null>(() => restoreUser(localStorage.getItem('token')))

  const login = useCallback(async (username: string, password: string) => {
    const res = await api.login(username, password)
    localStorage.setItem('token', res.token)
    localStorage.setItem('username', res.user.username)
    setToken(res.token)
    setUser(res.user)
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('token')
    localStorage.removeItem('username')
    setToken(null)
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider value={{ user, token, isAuthenticated: !!token, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
