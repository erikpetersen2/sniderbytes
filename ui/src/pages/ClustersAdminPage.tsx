import { useEffect, useState } from 'react'
import {
  getAdminClusters,
  createAdminCluster,
  updateAdminCluster,
  deleteAdminCluster,
  getEnvironments,
  type ClusterWriteRequest,
} from '../api/client'
import type { ClusterAdmin, EnvironmentOption } from '../types'

const emptyForm: ClusterWriteRequest = {
  name: '',
  environment_id: 0,
  grafana_url: '',
  grafana_auth_type: 'token',
  grafana_token: '',
  grafana_client_id: '',
  grafana_token_url: '',
}

export default function ClustersAdminPage() {
  const [clusters, setClusters] = useState<ClusterAdmin[]>([])
  const [environments, setEnvironments] = useState<EnvironmentOption[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState<ClusterWriteRequest>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  const loadData = () => {
    setLoading(true)
    Promise.all([getAdminClusters(), getEnvironments()])
      .then(([c, e]) => {
        setClusters(c)
        setEnvironments(e)
      })
      .catch(() => setError('Failed to load data'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadData()
  }, [])

  // Group environments by customer for the select element
  const envByCustomer = environments.reduce<Record<string, EnvironmentOption[]>>((acc, e) => {
    if (!acc[e.customer]) acc[e.customer] = []
    acc[e.customer].push(e)
    return acc
  }, {})

  const openCreate = () => {
    setEditingId(null)
    setForm(emptyForm)
    setFormError('')
    setShowForm(true)
  }

  const openEdit = (cluster: ClusterAdmin) => {
    setEditingId(cluster.id)
    setForm({
      name: cluster.name,
      environment_id: cluster.environment_id,
      grafana_url: cluster.grafana_url,
      grafana_auth_type: cluster.grafana_auth_type,
      grafana_token: '',
      grafana_client_id: cluster.grafana_client_id,
      grafana_token_url: cluster.grafana_token_url,
    })
    setFormError('')
    setShowForm(true)
  }

  const closeForm = () => {
    setShowForm(false)
    setEditingId(null)
    setForm(emptyForm)
    setFormError('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setFormError('')
    try {
      if (editingId !== null) {
        await updateAdminCluster(editingId, form)
      } else {
        await createAdminCluster(form)
      }
      closeForm()
      loadData()
    } catch {
      setFormError('Failed to save cluster. Please check your input and try again.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: number, name: string) => {
    if (!window.confirm(`Delete cluster "${name}"? This cannot be undone.`)) return
    try {
      await deleteAdminCluster(id)
      loadData()
    } catch {
      setError('Failed to delete cluster')
    }
  }

  const setField = <K extends keyof ClusterWriteRequest>(key: K, value: ClusterWriteRequest[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
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
        <h1 className="text-lg font-semibold text-white">Cluster Management</h1>
        <button
          onClick={openCreate}
          className="text-xs bg-ops-accent text-black font-semibold px-3 py-1.5 rounded hover:bg-ops-accent/80 transition-colors"
        >
          Add Cluster
        </button>
      </div>

      {error && <p className="text-ops-danger text-sm">{error}</p>}

      {showForm && (
        <div className="border border-ops-border rounded bg-ops-surface p-4 space-y-4">
          <h2 className="text-sm font-semibold text-white">
            {editingId !== null ? 'Edit Cluster' : 'New Cluster'}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-ops-muted mb-1">Name *</label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setField('name', e.target.value)}
                  className="w-full bg-ops-bg border border-ops-border rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-ops-accent"
                />
              </div>

              <div>
                <label className="block text-xs text-ops-muted mb-1">Environment *</label>
                <select
                  required
                  value={form.environment_id || ''}
                  onChange={(e) => setField('environment_id', Number(e.target.value))}
                  className="w-full bg-ops-bg border border-ops-border rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-ops-accent"
                >
                  <option value="">Select environment...</option>
                  {Object.entries(envByCustomer).map(([customer, envs]) => (
                    <optgroup key={customer} label={customer}>
                      {envs.map((env) => (
                        <option key={env.id} value={env.id}>
                          {env.name}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs text-ops-muted mb-1">Grafana URL</label>
                <input
                  type="text"
                  value={form.grafana_url}
                  onChange={(e) => setField('grafana_url', e.target.value)}
                  placeholder="https://grafana.example.com"
                  className="w-full bg-ops-bg border border-ops-border rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-ops-accent"
                />
              </div>

              <div>
                <label className="block text-xs text-ops-muted mb-1">Auth Type *</label>
                <select
                  required
                  value={form.grafana_auth_type}
                  onChange={(e) => setField('grafana_auth_type', e.target.value as 'token' | 'keycloak')}
                  className="w-full bg-ops-bg border border-ops-border rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-ops-accent"
                >
                  <option value="token">Service Account Token</option>
                  <option value="keycloak">Keycloak Client Credentials</option>
                </select>
              </div>
            </div>

            {form.grafana_auth_type === 'token' && (
              <div>
                <label className="block text-xs text-ops-muted mb-1">
                  Service Account Token{editingId !== null ? '' : ' *'}
                </label>
                <input
                  type="password"
                  required={editingId === null}
                  value={form.grafana_token}
                  onChange={(e) => setField('grafana_token', e.target.value)}
                  placeholder={editingId !== null ? 'Leave blank to keep existing' : 'glsa_...'}
                  className="w-full bg-ops-bg border border-ops-border rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-ops-accent"
                />
              </div>
            )}

            {form.grafana_auth_type === 'keycloak' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-ops-muted mb-1">Client ID *</label>
                  <input
                    type="text"
                    required
                    value={form.grafana_client_id}
                    onChange={(e) => setField('grafana_client_id', e.target.value)}
                    className="w-full bg-ops-bg border border-ops-border rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-ops-accent"
                  />
                </div>

                <div>
                  <label className="block text-xs text-ops-muted mb-1">
                    Client Secret{editingId !== null ? '' : ' *'}
                  </label>
                  <input
                    type="password"
                    required={editingId === null}
                    value={form.grafana_token}
                    onChange={(e) => setField('grafana_token', e.target.value)}
                    placeholder={editingId !== null ? 'Leave blank to keep existing' : ''}
                    className="w-full bg-ops-bg border border-ops-border rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-ops-accent"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-xs text-ops-muted mb-1">Token URL *</label>
                  <input
                    type="text"
                    required
                    value={form.grafana_token_url}
                    onChange={(e) => setField('grafana_token_url', e.target.value)}
                    placeholder="https://keycloak.example.com/auth/realms/myrealm/protocol/openid-connect/token"
                    className="w-full bg-ops-bg border border-ops-border rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-ops-accent"
                  />
                </div>
              </div>
            )}

            {formError && <p className="text-ops-danger text-xs">{formError}</p>}

            <div className="flex gap-2 pt-1">
              <button
                type="submit"
                disabled={saving}
                className="text-xs bg-ops-accent text-black font-semibold px-3 py-1.5 rounded hover:bg-ops-accent/80 transition-colors disabled:opacity-50"
              >
                {saving ? 'Saving...' : editingId !== null ? 'Save Changes' : 'Create Cluster'}
              </button>
              <button
                type="button"
                onClick={closeForm}
                className="text-xs text-ops-muted hover:text-gray-300 px-3 py-1.5 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="border border-ops-border rounded overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-ops-surface border-b border-ops-border">
            <tr>
              <th className="px-4 py-2 text-left text-xs text-ops-muted font-semibold uppercase tracking-wider">
                Customer / Environment
              </th>
              <th className="px-4 py-2 text-left text-xs text-ops-muted font-semibold uppercase tracking-wider">
                Cluster
              </th>
              <th className="px-4 py-2 text-left text-xs text-ops-muted font-semibold uppercase tracking-wider">
                Grafana URL
              </th>
              <th className="px-4 py-2 text-left text-xs text-ops-muted font-semibold uppercase tracking-wider">
                Auth
              </th>
              <th className="px-4 py-2 text-right text-xs text-ops-muted font-semibold uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ops-border">
            {clusters.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-4 text-xs text-ops-muted text-center">
                  No clusters configured.
                </td>
              </tr>
            ) : (
              clusters.map((cluster) => (
                <tr key={cluster.id} className="bg-ops-bg hover:bg-ops-surface/50 transition-colors">
                  <td className="px-4 py-2.5 text-xs text-ops-muted">
                    <span className="font-semibold text-white">{cluster.customer}</span>
                    <span className="mx-1 text-ops-border">/</span>
                    <span className="italic">{cluster.environment}</span>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-white font-mono">{cluster.name}</td>
                  <td className="px-4 py-2.5 text-xs text-ops-muted font-mono truncate max-w-xs">
                    {cluster.grafana_url || <span className="italic">not set</span>}
                  </td>
                  <td className="px-4 py-2.5 text-xs">
                    <span
                      className={`px-1.5 py-0.5 rounded font-mono ${
                        cluster.grafana_auth_type === 'keycloak'
                          ? 'bg-blue-500/20 text-blue-400'
                          : 'bg-ops-border text-ops-muted'
                      }`}
                    >
                      {cluster.grafana_auth_type === 'keycloak' ? 'keycloak' : 'token'}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-right space-x-2">
                    <button
                      onClick={() => openEdit(cluster)}
                      className="text-ops-muted hover:text-white transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(cluster.id, cluster.name)}
                      className="text-ops-danger hover:text-red-400 transition-colors"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
