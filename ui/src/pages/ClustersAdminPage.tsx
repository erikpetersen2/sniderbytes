import { useEffect, useState } from 'react'
import {
  getAdminClusters,
  createAdminCluster,
  updateAdminCluster,
  deleteAdminCluster,
  getEnvironments,
  createOrganization,
  type ClusterWriteRequest,
} from '../api/client'
import type { ClusterAdmin, EnvironmentOption } from '../types'

const emptyClusterForm: ClusterWriteRequest = {
  name: '',
  environment_id: 0,
  grafana_url: '',
  grafana_auth_type: 'token',
  grafana_token: '',
  grafana_client_id: '',
  grafana_token_url: '',
}

const emptyOrgForm = { customerName: '', environmentName: '' }

export default function ClustersAdminPage() {
  const [clusters, setClusters] = useState<ClusterAdmin[]>([])
  const [environments, setEnvironments] = useState<EnvironmentOption[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedOrg, setSelectedOrg] = useState('')

  // cluster form
  const [showClusterForm, setShowClusterForm] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [clusterForm, setClusterForm] = useState<ClusterWriteRequest>(emptyClusterForm)
  const [clusterSaving, setClusterSaving] = useState(false)
  const [clusterFormError, setClusterFormError] = useState('')

  // org form
  const [showOrgForm, setShowOrgForm] = useState(false)
  const [orgForm, setOrgForm] = useState(emptyOrgForm)
  const [orgSaving, setOrgSaving] = useState(false)
  const [orgFormError, setOrgFormError] = useState('')

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

  useEffect(() => { loadData() }, [])

  // Derived: org list, scoped envs and clusters
  const orgs = [...new Set(environments.map((e) => e.customer))].sort()
  const orgEnvs = environments.filter((e) => e.customer === selectedOrg)
  const orgClusters = clusters.filter((c) => c.customer === selectedOrg)

  const handleOrgChange = (org: string) => {
    setSelectedOrg(org)
    setShowClusterForm(false)
  }

  // --- cluster form handlers ---
  const openCreate = () => {
    setEditingId(null)
    setClusterForm({ ...emptyClusterForm, environment_id: orgEnvs[0]?.id ?? 0 })
    setClusterFormError('')
    setShowOrgForm(false)
    setShowClusterForm(true)
  }

  const openEdit = (cluster: ClusterAdmin) => {
    setEditingId(cluster.id)
    setClusterForm({
      name: cluster.name,
      environment_id: cluster.environment_id,
      grafana_url: cluster.grafana_url,
      grafana_auth_type: cluster.grafana_auth_type,
      grafana_token: '',
      grafana_client_id: cluster.grafana_client_id,
      grafana_token_url: cluster.grafana_token_url,
    })
    setClusterFormError('')
    setShowOrgForm(false)
    setShowClusterForm(true)
  }

  const closeClusterForm = () => {
    setShowClusterForm(false)
    setEditingId(null)
    setClusterForm(emptyClusterForm)
    setClusterFormError('')
  }

  const handleClusterSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setClusterSaving(true)
    setClusterFormError('')
    try {
      if (editingId !== null) {
        await updateAdminCluster(editingId, clusterForm)
      } else {
        await createAdminCluster(clusterForm)
      }
      closeClusterForm()
      loadData()
    } catch {
      setClusterFormError('Failed to save cluster. Please check your input and try again.')
    } finally {
      setClusterSaving(false)
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

  const setClusterField = <K extends keyof ClusterWriteRequest>(key: K, value: ClusterWriteRequest[K]) => {
    setClusterForm((prev) => ({ ...prev, [key]: value }))
  }

  // --- org form handlers ---
  const openOrgForm = () => {
    setOrgForm(emptyOrgForm)
    setOrgFormError('')
    setShowClusterForm(false)
    setShowOrgForm(true)
  }

  const closeOrgForm = () => {
    setShowOrgForm(false)
    setOrgForm(emptyOrgForm)
    setOrgFormError('')
  }

  const handleOrgSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setOrgSaving(true)
    setOrgFormError('')
    try {
      await createOrganization(orgForm.customerName, orgForm.environmentName)
      closeOrgForm()
      loadData()
    } catch {
      setOrgFormError('Failed to create organization. Please try again.')
    } finally {
      setOrgSaving(false)
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

      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-white">Organization Management</h1>
        <button
          onClick={openOrgForm}
          className="text-xs border border-ops-accent text-ops-accent font-semibold px-3 py-1.5 rounded hover:bg-ops-accent/10 transition-colors"
        >
          + New Organization
        </button>
      </div>

      {error && <p className="text-ops-danger text-sm">{error}</p>}

      {/* New Organization form */}
      {showOrgForm && (
        <div className="border border-ops-border rounded bg-ops-surface p-4 space-y-4">
          <h2 className="text-sm font-semibold text-white">New Organization</h2>
          <form onSubmit={handleOrgSubmit} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-ops-muted mb-1">Organization Name *</label>
                <input
                  type="text"
                  required
                  value={orgForm.customerName}
                  onChange={(e) => setOrgForm((p) => ({ ...p, customerName: e.target.value }))}
                  placeholder="e.g. Acme Corp"
                  className="w-full bg-ops-bg border border-ops-border rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-ops-accent"
                />
              </div>
              <div>
                <label className="block text-xs text-ops-muted mb-1">First Environment Name *</label>
                <input
                  type="text"
                  required
                  value={orgForm.environmentName}
                  onChange={(e) => setOrgForm((p) => ({ ...p, environmentName: e.target.value }))}
                  placeholder="e.g. Dev"
                  className="w-full bg-ops-bg border border-ops-border rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-ops-accent"
                />
              </div>
            </div>
            {orgFormError && <p className="text-ops-danger text-xs">{orgFormError}</p>}
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={orgSaving}
                className="text-xs bg-ops-accent text-black font-semibold px-3 py-1.5 rounded hover:bg-ops-accent/80 transition-colors disabled:opacity-50"
              >
                {orgSaving ? 'Creating...' : 'Create Organization'}
              </button>
              <button type="button" onClick={closeOrgForm} className="text-xs text-ops-muted hover:text-gray-300 px-3 py-1.5 transition-colors">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Org selector */}
      <div className="flex items-center gap-3">
        <label className="text-xs text-ops-muted whitespace-nowrap">View organization:</label>
        <select
          value={selectedOrg}
          onChange={(e) => handleOrgChange(e.target.value)}
          className="bg-ops-surface border border-ops-border rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:border-ops-accent min-w-48"
        >
          <option value="">— select an organization —</option>
          {orgs.map((org) => (
            <option key={org} value={org}>{org}</option>
          ))}
        </select>
      </div>

      {/* Org-scoped content */}
      {!selectedOrg ? (
        <p className="text-xs text-ops-muted italic">Select an organization above to view and manage its clusters and panels.</p>
      ) : (
        <div className="space-y-6">

          {/* Clusters */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-white">Clusters</h2>
              <button
                onClick={openCreate}
                className="text-xs bg-ops-accent text-black font-semibold px-3 py-1.5 rounded hover:bg-ops-accent/80 transition-colors"
              >
                + Add Cluster
              </button>
            </div>

            {showClusterForm && (
              <div className="border border-ops-border rounded bg-ops-surface p-4 space-y-4 mb-4">
                <h3 className="text-sm font-semibold text-white">
                  {editingId !== null ? 'Edit Cluster' : 'New Cluster'}
                </h3>
                <form onSubmit={handleClusterSubmit} className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-ops-muted mb-1">Name *</label>
                      <input
                        type="text"
                        required
                        value={clusterForm.name}
                        onChange={(e) => setClusterField('name', e.target.value)}
                        className="w-full bg-ops-bg border border-ops-border rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-ops-accent"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-ops-muted mb-1">Environment *</label>
                      <select
                        required
                        value={clusterForm.environment_id || ''}
                        onChange={(e) => setClusterField('environment_id', Number(e.target.value))}
                        className="w-full bg-ops-bg border border-ops-border rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-ops-accent"
                      >
                        <option value="">Select environment...</option>
                        {orgEnvs.map((env) => (
                          <option key={env.id} value={env.id}>{env.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-ops-muted mb-1">Grafana URL</label>
                      <input
                        type="text"
                        value={clusterForm.grafana_url}
                        onChange={(e) => setClusterField('grafana_url', e.target.value)}
                        placeholder="https://grafana.example.com"
                        className="w-full bg-ops-bg border border-ops-border rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-ops-accent"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-ops-muted mb-1">Auth Type *</label>
                      <select
                        required
                        value={clusterForm.grafana_auth_type}
                        onChange={(e) => setClusterField('grafana_auth_type', e.target.value as 'token' | 'keycloak')}
                        className="w-full bg-ops-bg border border-ops-border rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-ops-accent"
                      >
                        <option value="token">Service Account Token</option>
                        <option value="keycloak">Keycloak Client Credentials</option>
                      </select>
                    </div>
                  </div>

                  {clusterForm.grafana_auth_type === 'token' && (
                    <div>
                      <label className="block text-xs text-ops-muted mb-1">
                        Service Account Token{editingId !== null ? '' : ' *'}
                      </label>
                      <input
                        type="password"
                        required={editingId === null}
                        value={clusterForm.grafana_token}
                        onChange={(e) => setClusterField('grafana_token', e.target.value)}
                        placeholder={editingId !== null ? 'Leave blank to keep existing' : 'glsa_...'}
                        className="w-full bg-ops-bg border border-ops-border rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-ops-accent"
                      />
                    </div>
                  )}

                  {clusterForm.grafana_auth_type === 'keycloak' && (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-ops-muted mb-1">Client ID *</label>
                        <input
                          type="text"
                          required
                          value={clusterForm.grafana_client_id}
                          onChange={(e) => setClusterField('grafana_client_id', e.target.value)}
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
                          value={clusterForm.grafana_token}
                          onChange={(e) => setClusterField('grafana_token', e.target.value)}
                          placeholder={editingId !== null ? 'Leave blank to keep existing' : ''}
                          className="w-full bg-ops-bg border border-ops-border rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-ops-accent"
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="block text-xs text-ops-muted mb-1">Token URL *</label>
                        <input
                          type="text"
                          required
                          value={clusterForm.grafana_token_url}
                          onChange={(e) => setClusterField('grafana_token_url', e.target.value)}
                          placeholder="https://keycloak.example.com/auth/realms/myrealm/protocol/openid-connect/token"
                          className="w-full bg-ops-bg border border-ops-border rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-ops-accent"
                        />
                      </div>
                    </div>
                  )}

                  {clusterFormError && <p className="text-ops-danger text-xs">{clusterFormError}</p>}
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={clusterSaving}
                      className="text-xs bg-ops-accent text-black font-semibold px-3 py-1.5 rounded hover:bg-ops-accent/80 transition-colors disabled:opacity-50"
                    >
                      {clusterSaving ? 'Saving...' : editingId !== null ? 'Save Changes' : 'Create Cluster'}
                    </button>
                    <button type="button" onClick={closeClusterForm} className="text-xs text-ops-muted hover:text-gray-300 px-3 py-1.5 transition-colors">
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
                    <th className="px-4 py-2 text-left text-xs text-ops-muted font-semibold uppercase tracking-wider">Environment</th>
                    <th className="px-4 py-2 text-left text-xs text-ops-muted font-semibold uppercase tracking-wider">Cluster</th>
                    <th className="px-4 py-2 text-left text-xs text-ops-muted font-semibold uppercase tracking-wider">Grafana URL</th>
                    <th className="px-4 py-2 text-left text-xs text-ops-muted font-semibold uppercase tracking-wider">Auth</th>
                    <th className="px-4 py-2 text-right text-xs text-ops-muted font-semibold uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ops-border">
                  {orgClusters.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-4 text-xs text-ops-muted text-center">
                        No clusters in this organization.
                      </td>
                    </tr>
                  ) : (
                    orgClusters.map((cluster) => (
                      <tr key={cluster.id} className="bg-ops-bg hover:bg-ops-surface/50 transition-colors">
                        <td className="px-4 py-2.5 text-xs text-ops-muted italic">{cluster.environment}</td>
                        <td className="px-4 py-2.5 text-xs text-white font-mono">{cluster.name}</td>
                        <td className="px-4 py-2.5 text-xs text-ops-muted font-mono truncate max-w-xs">
                          {cluster.grafana_url || <span className="italic">not set</span>}
                        </td>
                        <td className="px-4 py-2.5 text-xs">
                          <span className={`px-1.5 py-0.5 rounded font-mono ${
                            cluster.grafana_auth_type === 'keycloak'
                              ? 'bg-blue-500/20 text-blue-400'
                              : 'bg-ops-border text-ops-muted'
                          }`}>
                            {cluster.grafana_auth_type === 'keycloak' ? 'keycloak' : 'token'}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-xs text-right space-x-2">
                          <button onClick={() => openEdit(cluster)} className="text-ops-muted hover:text-white transition-colors">Edit</button>
                          <button onClick={() => handleDelete(cluster.id, cluster.name)} className="text-ops-danger hover:text-red-400 transition-colors">Delete</button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
