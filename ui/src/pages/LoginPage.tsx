import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

export default function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(username, password)
      navigate('/')
    } catch {
      setError('Invalid credentials')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-ops-bg flex items-center justify-center">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-ops-accent text-4xl font-mono font-bold mb-2">⬡</div>
          <h1 className="text-2xl font-bold text-white">Sniderbytes</h1>
          <p className="text-ops-muted text-sm mt-1">Cluster Observability Platform</p>
        </div>

        <div className="bg-ops-surface border border-ops-border rounded-lg p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm text-ops-muted mb-1">Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-ops-bg border border-ops-border rounded px-3 py-2 text-white focus:outline-none focus:border-ops-accent transition-colors"
                placeholder="admin"
                autoComplete="username"
                required
              />
            </div>
            <div>
              <label className="block text-sm text-ops-muted mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-ops-bg border border-ops-border rounded px-3 py-2 text-white focus:outline-none focus:border-ops-accent transition-colors"
                placeholder="••••••••"
                autoComplete="current-password"
                required
              />
            </div>

            {error && (
              <p className="text-ops-danger text-sm">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-ops-accent hover:bg-ops-accent-hover text-ops-bg font-semibold rounded px-4 py-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-ops-border">
            <p className="text-xs text-ops-muted text-center">Demo credentials</p>
            <div className="mt-2 grid grid-cols-3 gap-2 text-xs font-mono">
              <div className="bg-ops-bg rounded p-2">
                <div className="text-ops-accent">admin</div>
                <div className="text-ops-muted">admin / admin</div>
              </div>
              <div className="bg-ops-bg rounded p-2">
                <div className="text-ops-accent">alice</div>
                <div className="text-ops-muted">alice / alice123</div>
              </div>
              <div className="bg-ops-bg rounded p-2">
                <div className="text-ops-accent">bob</div>
                <div className="text-ops-muted">bob / bob123</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
