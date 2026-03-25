import { useEffect, useState } from 'react'
import {
  getAdminClusters,
  createAdminCluster,
  updateAdminCluster,
  deleteAdminCluster,
  getEnvironments,
  createOrganization,
  getPanels,
  createPanel,
  updatePanel,
  deletePanel,
  type ClusterWriteRequest,
} from '../api/client'
import type { ClusterAdmin, EnvironmentOption, Panel } from '../types'

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

  // panel management
  const [activePanelEnvId, setActivePanelEnvId] = useState<number | null>(null)
  const [panels, setPanels] = useState<Panel[]>([])
  const [panelsLoading, setPanelsLoading] = useState(false)
  const [editingPanelId, setEditingPanelId] = useState<number | null>(null)
  const [showPanelForm, setShowPanelForm] = useState(false)
  const [panelForm, setPanelForm] = useState({ name: '', expr: '', unit: '', position: 0 })
  const [panelSaving, setPanelSaving] = useState(false)
  const [panelFormError, setPanelFormError] = useState('')

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

  const envByCustomer = environments.reduce<Record<string, EnvironmentOption[]>>((acc, e) => {
    if (!acc[e.customer]) acc[e.customer] = []
    acc[e.customer].push(e)
    return acc
  }, {})

  // --- cluster form handlers ---
  const openCreate = () => {
    setEditingId(null)
    setClusterForm(emptyClusterForm)
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

  // --- panel management handlers ---
  const openPanelManager = (envId: number) => {
    if (activePanelEnvId === envId) {
      setActivePanelEnvId(null)
      return
    }
    setActivePanelEnvId(envId)
    setShowPanelForm(false)
    setPanelFormError('')
    setPanelsLoading(true)
    getPanels(envId)
      .then(setPanels)
      .finally(() => setPanelsLoading(false))
  }

  const openAddPanel = () => {
    setEditingPanelId(null)
    setPanelForm({ name: '', expr: '', unit: '', position: panels.length })
    setPanelFormError('')
    setShowPanelForm(true)
  }

  const openEditPanel = (p: Panel) => {
    setEditingPanelId(p.id)
    setPanelForm({ name: p.name, expr: p.expr, unit: p.unit, position: p.position })
    setPanelFormError('')
    setShowPanelForm(true)
  }

  const closePanelForm = () => {
    setShowPanelForm(false)
    setEditingPanelId(null)
    setPanelFormError('')
  }

  const handlePanelSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (activePanelEnvId === null) return
    setPanelSaving(true)
    setPanelFormError('')
    try {
      if (editingPanelId !== null) {
        await updatePanel(editingPanelId, panelForm)
      } else {
        await createPanel(activePanelEnvId, panelForm)
      }
      closePanelForm()
      getPanels(activePanelEnvId).then(setPanels)
    } catch {
      setPanelFormError('Failed to save panel.')
    } finally {
      setPanelSaving(false)
    }
  }

  const handleDeletePanel = async (id: number) => {
    if (!window.confirm('Delete this panel?')) return
    await deletePanel(id)
    if (activePanelEnvId !== null) getPanels(activePanelEnvId).then(setPanels)
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
        <h1 className="text-lg font-semibold text-white">Organization Management</h1>
        <div className="flex gap-2">
          <button
            onClick={openOrgForm}
            className="text-xs border border-ops-accent text-ops-accent font-semibold px-3 py-1.5 rounded hover:bg-ops-accent/10 transition-colors"
          >
            Add Organization
          </button>
          <button
            onClick={openCreate}
            className="text-xs bg-ops-accent text-black font-semibold px-3 py-1.5 rounded hover:bg-ops-accent/80 transition-colors"
          >
            Add Cluster
          </button>
        </div>
      </div>

      {error && <p className="text-ops-danger text-sm">{error}</p>}

      {/* Add Organization form */}
      {showOrgForm && (
        <div className="border border-ops-border rounded bg-ops-surface p-4 space-y-4">
          <h2 className="text-sm font-semibold text-white">New Organization</h2>
          <p className="text-xs text-ops-muted">
            Creates a new customer and its first environment. You can add clusters to it afterwards.
          </p>
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
            <div className="flex gap-2 pt-1">
              <button
                type="submit"
                disabled={orgSaving}
                className="text-xs bg-ops-accent text-black font-semibold px-3 py-1.5 rounded hover:bg-ops-accent/80 transition-colors disabled:opacity-50"
              >
                {orgSaving ? 'Creating...' : 'Create Organization'}
              </button>
              <button
                type="button"
                onClick={closeOrgForm}
                className="text-xs text-ops-muted hover:text-gray-300 px-3 py-1.5 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Add / Edit Cluster form */}
      {showClusterForm && (
        <div className="border border-ops-border rounded bg-ops-surface p-4 space-y-4">
          <h2 className="text-sm font-semibold text-white">
            {editingId !== null ? 'Edit Cluster' : 'New Cluster'}
          </h2>

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

            <div className="flex gap-2 pt-1">
              <button
                type="submit"
                disabled={clusterSaving}
                className="text-xs bg-ops-accent text-black font-semibold px-3 py-1.5 rounded hover:bg-ops-accent/80 transition-colors disabled:opacity-50"
              >
                {clusterSaving ? 'Saving...' : editingId !== null ? 'Save Changes' : 'Create Cluster'}
              </button>
              <button
                type="button"
                onClick={closeClusterForm}
                className="text-xs text-ops-muted hover:text-gray-300 px-3 py-1.5 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Environments & Panels */}
      <div>
        <h2 className="text-sm font-semibold text-white mb-3">Environments &amp; Panels</h2>
        <div className="space-y-2">
          {Object.entries(envByCustomer).map(([customer, envs]) => (
            <div key={customer}>
              <div className="text-xs font-semibold text-ops-muted uppercase tracking-wider mb-1">{customer}</div>
              {envs.map((env) => (
                <div key={env.id} className="border border-ops-border rounded overflow-hidden mb-2">
                  <div className="flex items-center justify-between px-4 py-2 bg-ops-surface">
                    <span className="text-xs text-white italic">{env.name}</span>
                    <button
                      onClick={() => openPanelManager(env.id)}
                      className={`text-xs px-2 py-1 rounded transition-colors ${
                        activePanelEnvId === env.id
                          ? 'text-ops-accent border border-ops-accent'
                          : 'text-ops-muted hover:text-white border border-ops-border'
                      }`}
                    >
                      {activePanelEnvId === env.id ? 'Close Panels' : 'Manage Panels'}
                    </button>
                  </div>

                  {activePanelEnvId === env.id && (
                    <div className="bg-ops-bg px-4 py-3 space-y-3">
                      {panelsLoading ? (
                        <div className="space-y-2">
                          {[1, 2].map((i) => <div key={i} className="h-6 bg-ops-border rounded animate-pulse" />)}
                        </div>
                      ) : (
                        <>
                          {panels.length === 0 ? (
                            <p className="text-xs text-ops-muted italic">
                              No panels configured — using built-in defaults (CPU, Memory, Pod Count, Request Rate, Error Rate).
                            </p>
                          ) : (
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="text-ops-muted">
                                  <th className="text-left py-1 pr-3 font-semibold">Name</th>
                                  <th className="text-left py-1 pr-3 font-semibold">Expression</th>
                                  <th className="text-left py-1 pr-3 font-semibold">Unit</th>
                                  <th className="text-left py-1 pr-3 font-semibold">Pos</th>
                                  <th />
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-ops-border">
                                {panels.map((p) => (
                                  <tr key={p.id}>
                                    <td className="py-1.5 pr-3 text-white">{p.name}</td>
                                    <td className="py-1.5 pr-3 font-mono text-ops-muted max-w-xs truncate" title={p.expr}>{p.expr}</td>
                                    <td className="py-1.5 pr-3 text-ops-muted">{p.unit || '—'}</td>
                                    <td className="py-1.5 pr-3 text-ops-muted">{p.position}</td>
                                    <td className="py-1.5 text-right space-x-2 whitespace-nowrap">
                                      <button onClick={() => openEditPanel(p)} className="text-ops-muted hover:text-white transition-colors">Edit</button>
                                      <button onClick={() => handleDeletePanel(p.id)} className="text-ops-danger hover:text-red-400 transition-colors">Delete</button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}

                          {showPanelForm ? (
                            <form onSubmit={handlePanelSubmit} className="border border-ops-border rounded p-3 space-y-2 bg-ops-surface">
                              <div className="text-xs font-semibold text-white">{editingPanelId !== null ? 'Edit Panel' : 'New Panel'}</div>
                              <div className="grid grid-cols-3 gap-2">
                                <div>
                                  <label className="block text-xs text-ops-muted mb-1">Name *</label>
                                  <input
                                    type="text"
                                    required
                                    value={panelForm.name}
                                    onChange={(e) => setPanelForm((p) => ({ ...p, name: e.target.value }))}
                                    placeholder="CPU Usage"
                                    className="w-full bg-ops-bg border border-ops-border rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-ops-accent"
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs text-ops-muted mb-1">Unit</label>
                                  <input
                                    type="text"
                                    value={panelForm.unit}
                                    onChange={(e) => setPanelForm((p) => ({ ...p, unit: e.target.value }))}
                                    placeholder="%"
                                    className="w-full bg-ops-bg border border-ops-border rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-ops-accent"
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs text-ops-muted mb-1">Position</label>
                                  <input
                                    type="number"
                                    value={panelForm.position}
                                    onChange={(e) => setPanelForm((p) => ({ ...p, position: Number(e.target.value) }))}
                                    className="w-full bg-ops-bg border border-ops-border rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-ops-accent"
                                  />
                                </div>
                              </div>
                              <div>
                                <label className="block text-xs text-ops-muted mb-1">PromQL Expression *</label>
                                <textarea
                                  required
                                  rows={2}
                                  value={panelForm.expr}
                                  onChange={(e) => setPanelForm((p) => ({ ...p, expr: e.target.value }))}
                                  placeholder={`avg(rate(node_cpu_seconds_total{mode!="idle"}[5m])) * 100`}
                                  className="w-full bg-ops-bg border border-ops-border rounded px-2 py-1 text-xs text-white font-mono focus:outline-none focus:border-ops-accent resize-none"
                                />
                              </div>
                              {panelFormError && <p className="text-ops-danger text-xs">{panelFormError}</p>}
                              <div className="flex gap-2">
                                <button
                                  type="submit"
                                  disabled={panelSaving}
                                  className="text-xs bg-ops-accent text-black font-semibold px-3 py-1 rounded hover:bg-ops-accent/80 transition-colors disabled:opacity-50"
                                >
                                  {panelSaving ? 'Saving...' : editingPanelId !== null ? 'Save' : 'Add Panel'}
                                </button>
                                <button type="button" onClick={closePanelForm} className="text-xs text-ops-muted hover:text-gray-300 px-3 py-1 transition-colors">Cancel</button>
                              </div>
                            </form>
                          ) : (
                            <button
                              onClick={openAddPanel}
                              className="text-xs text-ops-accent hover:text-ops-accent/80 transition-colors"
                            >
                              + Add Panel
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ))}
          {environments.length === 0 && (
            <p className="text-xs text-ops-muted italic">No environments yet. Create an organization first.</p>
          )}
        </div>
      </div>

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
