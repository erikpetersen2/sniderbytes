import { useEffect, useState } from 'react'
import { NavLink, useParams } from 'react-router-dom'
import { getClusters } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import type { Cluster } from '../types'

export default function Sidebar() {
  const { user, logout } = useAuth()
  const { id: activeClusterId } = useParams()
  const [clusters, setClusters] = useState<Cluster[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getClusters()
      .then(setClusters)
      .finally(() => setLoading(false))
  }, [])

  // Group clusters by customer → environment
  const grouped = clusters.reduce<Record<string, Record<string, Cluster[]>>>((acc, c) => {
    if (!acc[c.customer]) acc[c.customer] = {}
    if (!acc[c.customer][c.environment]) acc[c.customer][c.environment] = []
    acc[c.customer][c.environment].push(c)
    return acc
  }, {})

  return (
    <aside className="fixed left-0 top-0 h-full w-60 bg-ops-surface border-r border-ops-border flex flex-col">
      {/* Logo */}
      <div className="px-4 py-4 border-b border-ops-border">
        <div className="flex items-center gap-2">
          <span className="text-ops-accent text-xl font-mono">⬡</span>
          <span className="font-bold text-white text-sm">Sniderbytes</span>
        </div>
      </div>

      {/* Cluster nav */}
      <nav className="flex-1 overflow-y-auto py-2">
        {loading ? (
          <div className="px-4 py-2 space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-4 bg-ops-border rounded animate-pulse" />
            ))}
          </div>
        ) : Object.keys(grouped).length === 0 ? (
          <p className="px-4 py-2 text-xs text-ops-muted">No clusters assigned</p>
        ) : (
          Object.entries(grouped).map(([customer, envs]) => (
            <div key={customer} className="mb-2">
              <div className="px-4 py-1 text-xs font-semibold text-ops-muted uppercase tracking-wider">
                {customer}
              </div>
              {Object.entries(envs).map(([env, clusterList]) => (
                <div key={env} className="mb-1">
                  <div className="px-6 py-0.5 text-xs text-ops-muted italic">{env}</div>
                  {clusterList.map((c) => (
                    <div key={c.id} className="mb-0.5">
                      <div
                        className={`px-8 py-1 text-xs font-mono flex items-center gap-1 ${
                          String(c.id) === activeClusterId ? 'text-ops-accent' : 'text-gray-400'
                        }`}
                      >
                        <span className="text-ops-border">›</span>
                        {c.name}
                      </div>
                      <div className="pl-10">
                        <NavLink
                          to={`/clusters/${c.id}/overview`}
                          className={({ isActive }) =>
                            `block py-0.5 text-xs ${
                              isActive ? 'text-ops-accent' : 'text-ops-muted hover:text-gray-300'
                            }`
                          }
                        >
                          Overview
                        </NavLink>
                        <NavLink
                          to={`/clusters/${c.id}/alerts`}
                          className={({ isActive }) =>
                            `block py-0.5 text-xs ${
                              isActive ? 'text-ops-accent' : 'text-ops-muted hover:text-gray-300'
                            }`
                          }
                        >
                          Alerts
                        </NavLink>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          ))
        )}
      </nav>

      {/* Admin links */}
      {user?.role === 'admin' && (
        <div className="border-t border-ops-border py-2">
          <NavLink
            to="/users"
            className={({ isActive }) =>
              `block px-4 py-1.5 text-xs ${
                isActive ? 'text-ops-accent' : 'text-ops-muted hover:text-gray-300'
              }`
            }
          >
            User Management
          </NavLink>
          <NavLink
            to="/admin/organizations"
            className={({ isActive }) =>
              `block px-4 py-1.5 text-xs ${
                isActive ? 'text-ops-accent' : 'text-ops-muted hover:text-gray-300'
              }`
            }
          >
            Organization Management
          </NavLink>
        </div>
      )}

      {/* User info */}
      <div className="border-t border-ops-border px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs text-white font-medium">{user?.username}</div>
            <div className="flex items-center gap-1 mt-0.5">
              <span
                className={`text-xs px-1.5 py-0.5 rounded font-mono ${
                  user?.role === 'admin'
                    ? 'bg-ops-accent/20 text-ops-accent'
                    : 'bg-ops-border text-ops-muted'
                }`}
              >
                {user?.role}
              </span>
            </div>
          </div>
          <button
            onClick={logout}
            className="text-xs text-ops-muted hover:text-ops-danger transition-colors"
          >
            Sign out
          </button>
        </div>
      </div>
    </aside>
  )
}
