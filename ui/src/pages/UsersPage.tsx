import { useEffect, useState } from 'react'
import { getUsers } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import type { User } from '../types'

export default function UsersPage() {
  const { user: currentUser } = useAuth()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    getUsers()
      .then(setUsers)
      .catch(() => setError('Failed to load users'))
      .finally(() => setLoading(false))
  }, [])

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
      <h1 className="text-lg font-semibold text-white">Users</h1>
      <p className="text-xs text-ops-muted">
        Users are provisioned automatically from Keycloak on first login. Roles are determined by
        Keycloak group membership.
      </p>

      {error && <p className="text-ops-danger text-sm">{error}</p>}

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
            </tr>
          </thead>
          <tbody className="divide-y divide-ops-border">
            {users.map((u) => (
              <tr
                key={u.id}
                className={`bg-ops-bg transition-colors ${u.id === currentUser?.id ? 'border-l-2 border-ops-accent' : ''}`}
              >
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
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
