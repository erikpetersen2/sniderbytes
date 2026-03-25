import { useEffect, useState } from 'react'
import { getClusters, getUsers, createUser, deleteUser } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import type { Cluster, User } from '../types'

export default function UsersPage() {
  const { user: currentUser } = useAuth()
  const [users, setUsers] = useState<User[]>([])
  const [clusters, setClusters] = useState<Cluster[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [showForm, setShowForm] = useState(false)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<'admin' | 'viewer'>('viewer')
  const [selectedClusters, setSelectedClusters] = useState<number[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')

  useEffect(() => {
    Promise.all([getUsers(), getClusters()])
      .then(([u, c]) => {
        setUsers(u)
        setClusters(c)
      })
      .catch(() => setError('Failed to load data'))
      .finally(() => setLoading(false))
  }, [])

  const grouped = clusters.reduce<Record<string, Record<string, Cluster[]>>>((acc, c) => {
    if (!acc[c.customer]) acc[c.customer] = {}
    if (!acc[c.customer][c.environment]) acc[c.customer][c.environment] = []
    acc[c.customer][c.environment].push(c)
    return acc
  }, {})

  function toggleCluster(id: number) {
    setSelectedClusters((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setFormError('')
    setSubmitting(true)
    try {
      const created = await createUser({
        username,
        password,
        role,
        cluster_ids: role === 'viewer' ? selectedClusters : [],
      })
      setUsers((prev) => [...prev, created].sort((a, b) => a.username.localeCompare(b.username)))
      setShowForm(false)
      setUsername('')
      setPassword('')
      setRole('viewer')
      setSelectedClusters([])
    } catch {
      setFormError('Failed to create user — username may already exist')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(id: number) {
    try {
      await deleteUser(id)
      setUsers((prev) => prev.filter((u) => u.id !== id))
    } catch {
      setError('Failed to delete user')
    }
  }

  if (loading) {
    return (
      <div className="p-6 space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-10 bg-ops-border rounded animate-pulse" />
        ))}
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-white">User Management</h1>
        <button
          onClick={() => { setShowForm(true); setFormError('') }}
          className="px-3 py-1.5 text-xs bg-ops-accent text-black font-semibold rounded hover:bg-ops-accent/80 transition-colors"
        >
          + Add User
        </button>
      </div>

      {error && <p className="text-ops-danger text-sm">{error}</p>}

      {showForm && (
        <form
          onSubmit={handleCreate}
          className="bg-ops-surface border border-ops-border rounded p-4 space-y-4"
        >
          <h2 className="text-sm font-semibold text-white">New User</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-ops-muted mb-1">Username</label>
              <input
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-ops-bg border border-ops-border rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:border-ops-accent"
              />
            </div>
            <div>
              <label className="block text-xs text-ops-muted mb-1">Password</label>
              <input
                required
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-ops-bg border border-ops-border rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:border-ops-accent"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs text-ops-muted mb-1">Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as 'admin' | 'viewer')}
              className="bg-ops-bg border border-ops-border rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:border-ops-accent"
            >
              <option value="viewer">Viewer</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          {role === 'viewer' && (
            <div>
              <label className="block text-xs text-ops-muted mb-2">Cluster Access</label>
              <div className="space-y-3 max-h-48 overflow-y-auto border border-ops-border rounded p-3">
                {Object.entries(grouped).map(([customer, envs]) => (
                  <div key={customer}>
                    <div className="text-xs font-semibold text-ops-muted uppercase tracking-wider mb-1">
                      {customer}
                    </div>
                    {Object.entries(envs).map(([env, clusterList]) => (
                      <div key={env} className="ml-2 mb-1">
                        <div className="text-xs text-ops-muted italic mb-1">{env}</div>
                        {clusterList.map((cl) => (
                          <label key={cl.id} className="flex items-center gap-2 ml-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={selectedClusters.includes(cl.id)}
                              onChange={() => toggleCluster(cl.id)}
                              className="accent-ops-accent"
                            />
                            <span className="text-xs text-gray-300 font-mono">{cl.name}</span>
                          </label>
                        ))}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}

          {formError && <p className="text-ops-danger text-xs">{formError}</p>}

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-1.5 text-xs bg-ops-accent text-black font-semibold rounded hover:bg-ops-accent/80 disabled:opacity-50 transition-colors"
            >
              {submitting ? 'Creating…' : 'Create'}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-4 py-1.5 text-xs border border-ops-border text-ops-muted rounded hover:text-white transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="border border-ops-border rounded overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-ops-surface border-b border-ops-border">
            <tr>
              <th className="px-4 py-2 text-left text-xs text-ops-muted font-semibold uppercase tracking-wider">
                Username
              </th>
              <th className="px-4 py-2 text-left text-xs text-ops-muted font-semibold uppercase tracking-wider">
                Role
              </th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-ops-border">
            {users.map((u) => (
              <tr key={u.id} className="bg-ops-bg hover:bg-ops-surface/50 transition-colors">
                <td className="px-4 py-2.5 text-white font-mono text-xs">{u.username}</td>
                <td className="px-4 py-2.5">
                  <span
                    className={`text-xs px-1.5 py-0.5 rounded font-mono ${
                      u.role === 'admin'
                        ? 'bg-ops-accent/20 text-ops-accent'
                        : 'bg-ops-border text-ops-muted'
                    }`}
                  >
                    {u.role}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-right">
                  {u.id !== currentUser?.id && (
                    <button
                      onClick={() => handleDelete(u.id)}
                      className="text-xs text-ops-muted hover:text-ops-danger transition-colors"
                    >
                      Remove
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
