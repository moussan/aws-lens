import { useEffect, useMemo, useState } from 'react'

import type { AssumeRoleRequest, AwsAssumeRoleTarget, AwsConnection, AwsSessionSummary, CallerIdentity, OverviewStatistics } from '@shared/types'
import {
  assumeRoleSession,
  assumeSavedRoleTarget,
  deleteAssumedSession,
  deleteAssumeRoleTarget,
  getCallerIdentity,
  getOverviewStatistics,
  saveAssumeRoleTarget
} from './api'

type ConnectionState = {
  profile: string
  region: string
  selectedProfile: { name: string } | null
  connection: AwsConnection | null
  activeSession: AwsSessionSummary | null
  targets: AwsAssumeRoleTarget[]
  sessions: AwsSessionSummary[]
  refreshProfiles: () => Promise<void>
  activateSession: (sessionId: string) => void
  clearActiveSession: () => void
}

type CompareOption = {
  id: string
  label: string
  connection: AwsConnection
}

type CompareResult = {
  option: CompareOption
  identity: CallerIdentity
  statistics: OverviewStatistics
}

function emptyDraft(profile: string, region: string): Omit<AwsAssumeRoleTarget, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    label: '',
    roleArn: '',
    defaultSessionName: 'aws-lens',
    externalId: '',
    sourceProfile: profile,
    defaultRegion: region
  }
}

function formatDateTime(value: string): string {
  return value ? new Date(value).toLocaleString() : '-'
}

function formatCountdown(expiration: string): string {
  const remainingMs = new Date(expiration).getTime() - Date.now()
  if (!Number.isFinite(remainingMs)) {
    return '-'
  }
  if (remainingMs <= 0) {
    return 'Expired'
  }

  const totalSeconds = Math.floor(remainingMs / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  return `${hours}h ${minutes}m ${seconds}s`
}

function buildSessionConnection(session: AwsSessionSummary): AwsConnection {
  return {
    kind: 'assumed-role',
    sessionId: session.id,
    label: session.label,
    profile: session.profile,
    sourceProfile: session.sourceProfile,
    region: session.region,
    roleArn: session.roleArn,
    assumedRoleArn: session.assumedRoleArn,
    accountId: session.accountId,
    accessKeyId: session.accessKeyId,
    expiration: session.expiration,
    externalId: session.externalId
  }
}

export function SessionHub({
  connectionState,
  onOpenTerminal
}: {
  connectionState: ConnectionState
  onOpenTerminal: (connection: AwsConnection) => void
}) {
  const [draft, setDraft] = useState<Omit<AwsAssumeRoleTarget, 'id' | 'createdAt' | 'updatedAt'>>(
    emptyDraft(connectionState.selectedProfile?.name ?? connectionState.profile, connectionState.region)
  )
  const [editingTargetId, setEditingTargetId] = useState('')
  const [busyId, setBusyId] = useState('')
  const [countdownTick, setCountdownTick] = useState(Date.now())
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [compareLeft, setCompareLeft] = useState('base')
  const [compareRight, setCompareRight] = useState('')
  const [compareBusy, setCompareBusy] = useState(false)
  const [compareResults, setCompareResults] = useState<CompareResult[] | null>(null)

  useEffect(() => {
    const timer = window.setInterval(() => setCountdownTick(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    setDraft((current) => ({
      ...current,
      sourceProfile: current.sourceProfile || connectionState.selectedProfile?.name || connectionState.profile,
      defaultRegion: current.defaultRegion || connectionState.region
    }))
  }, [connectionState.profile, connectionState.region, connectionState.selectedProfile])

  const compareOptions = useMemo<CompareOption[]>(() => {
    const options: CompareOption[] = []
    if (connectionState.profile) {
      options.push({
        id: 'base',
        label: `Base profile: ${connectionState.profile}`,
        connection: {
          kind: 'profile',
          sessionId: `profile:${connectionState.profile}`,
          label: connectionState.profile,
          profile: connectionState.profile,
          region: connectionState.region
        }
      })
    }

    for (const session of connectionState.sessions.filter((entry) => entry.status === 'active')) {
      options.push({
        id: `session:${session.id}`,
        label: `${session.label} (${session.accountId || 'unknown account'})`,
        connection: buildSessionConnection(session)
      })
    }
    return options
  }, [connectionState.profile, connectionState.region, connectionState.sessions])

  useEffect(() => {
    if (!compareRight && compareOptions[1]) {
      setCompareRight(compareOptions[1].id)
    }
  }, [compareOptions, compareRight])

  function updateDraft<K extends keyof typeof draft>(key: K, value: (typeof draft)[K]): void {
    setDraft((current) => ({ ...current, [key]: value }))
  }

  async function refreshSessionHub(): Promise<void> {
    await connectionState.refreshProfiles()
  }

  async function handleSaveTarget(): Promise<void> {
    setError('')
    setMessage('')
    setBusyId('save-target')
    try {
      await saveAssumeRoleTarget({
        ...draft,
        ...(editingTargetId ? { id: editingTargetId } : {}),
        sourceProfile: draft.sourceProfile || connectionState.profile,
        defaultRegion: draft.defaultRegion || connectionState.region
      })
      setDraft(emptyDraft(connectionState.selectedProfile?.name ?? connectionState.profile, connectionState.region))
      setEditingTargetId('')
      await refreshSessionHub()
      setMessage(editingTargetId ? 'Saved target updated.' : 'Saved target created.')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusyId('')
    }
  }

  async function handleAssume(request: AssumeRoleRequest): Promise<void> {
    setError('')
    setMessage('')
    setBusyId(request.label)
    try {
      const result = await assumeRoleSession(request)
      await refreshSessionHub()
      connectionState.activateSession(result.sessionId)
      setMessage(`Assumed ${result.label}. Temporary credentials are stored in memory only.`)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusyId('')
    }
  }

  async function handleAssumeTarget(target: AwsAssumeRoleTarget): Promise<void> {
    setError('')
    setMessage('')
    setBusyId(target.id)
    try {
      const result = target.sourceProfile
        ? await assumeSavedRoleTarget(target.id)
        : await assumeRoleSession({
            label: target.label,
            roleArn: target.roleArn,
            sessionName: target.defaultSessionName,
            externalId: target.externalId || undefined,
            sourceProfile: connectionState.profile || undefined,
            region: target.defaultRegion || connectionState.region
          })
      await refreshSessionHub()
      connectionState.activateSession(result.sessionId)
      setMessage(`Assumed ${result.label}. Temporary credentials are stored in memory only.`)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusyId('')
    }
  }

  async function handleDeleteTarget(targetId: string): Promise<void> {
    setError('')
    setMessage('')
    setBusyId(targetId)
    try {
      await deleteAssumeRoleTarget(targetId)
      if (editingTargetId === targetId) {
        setEditingTargetId('')
        setDraft(emptyDraft(connectionState.selectedProfile?.name ?? connectionState.profile, connectionState.region))
      }
      await refreshSessionHub()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusyId('')
    }
  }

  async function handleDeleteSession(sessionId: string): Promise<void> {
    setError('')
    setMessage('')
    setBusyId(sessionId)
    try {
      await deleteAssumedSession(sessionId)
      if (connectionState.activeSession?.id === sessionId) {
        connectionState.clearActiveSession()
      }
      await refreshSessionHub()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusyId('')
    }
  }

  async function handleCompare(): Promise<void> {
    const selected = [compareLeft, compareRight]
      .map((id) => compareOptions.find((entry) => entry.id === id) ?? null)
      .filter((entry): entry is CompareOption => Boolean(entry))

    if (selected.length < 2) {
      setError('Choose two contexts to compare.')
      return
    }

    setCompareBusy(true)
    setError('')
    try {
      const results = await Promise.all(selected.map(async (option) => {
        const [identity, statistics] = await Promise.all([
          getCallerIdentity(option.connection),
          getOverviewStatistics(option.connection)
        ])
        return { option, identity, statistics }
      }))
      setCompareResults(results)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setCompareResults(null)
    } finally {
      setCompareBusy(false)
    }
  }

  function loadTargetIntoForm(target: AwsAssumeRoleTarget): void {
    setEditingTargetId(target.id)
    setDraft({
      label: target.label,
      roleArn: target.roleArn,
      defaultSessionName: target.defaultSessionName,
      externalId: target.externalId,
      sourceProfile: target.sourceProfile,
      defaultRegion: target.defaultRegion
    })
  }

  void countdownTick

  return (
    <div className="svc-console">
      <div className="svc-tab-bar">
        <button className="svc-tab active" type="button">Session Hub</button>
        <button className="svc-tab right" type="button" onClick={() => void refreshSessionHub()}>Refresh</button>
      </div>

      {message && <div className="svc-msg">{message}</div>}
      {error && <div className="svc-error">{error}</div>}

      <div className="svc-panel" style={{ marginBottom: 12 }}>
        <h3>Current Context</h3>
        <div className="svc-kv">
          <div className="svc-kv-row"><div className="svc-kv-label">Active</div><div className="svc-kv-value">{connectionState.connection?.label ?? 'None'}</div></div>
          <div className="svc-kv-row"><div className="svc-kv-label">Mode</div><div className="svc-kv-value">{connectionState.connection?.kind ?? '-'}</div></div>
          <div className="svc-kv-row"><div className="svc-kv-label">Region</div><div className="svc-kv-value">{connectionState.connection?.region ?? '-'}</div></div>
          {connectionState.activeSession && (
            <>
              <div className="svc-kv-row"><div className="svc-kv-label">Assumed Role</div><div className="svc-kv-value">{connectionState.activeSession.assumedRoleArn}</div></div>
              <div className="svc-kv-row"><div className="svc-kv-label">Expires</div><div className="svc-kv-value">{formatDateTime(connectionState.activeSession.expiration)} ({formatCountdown(connectionState.activeSession.expiration)})</div></div>
            </>
          )}
        </div>
        <div className="svc-btn-row">
          {connectionState.connection && <button type="button" className="svc-btn primary" onClick={() => {
            const currentConnection = connectionState.connection
            if (currentConnection) {
              onOpenTerminal(currentConnection)
            }
          }}>Open Terminal</button>}
          {connectionState.activeSession && <button type="button" className="svc-btn" onClick={() => connectionState.clearActiveSession()}>Use Base Profile</button>}
        </div>
        <p style={{ marginTop: 10, opacity: 0.8 }}>
          Saved role definitions are persisted locally. Temporary credentials stay in memory only and are not written to AWS config or credentials files.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div className="svc-panel">
          <h3>{editingTargetId ? 'Edit Assume-Role Target' : 'New Assume-Role Target'}</h3>
          <div className="svc-form">
            <label><span>Label</span><input value={draft.label} onChange={(event) => updateDraft('label', event.target.value)} /></label>
            <label><span>Role ARN</span><input value={draft.roleArn} onChange={(event) => updateDraft('roleArn', event.target.value)} /></label>
            <label><span>Default Session Name</span><input value={draft.defaultSessionName} onChange={(event) => updateDraft('defaultSessionName', event.target.value)} /></label>
            <label><span>External ID</span><input value={draft.externalId} onChange={(event) => updateDraft('externalId', event.target.value)} placeholder="Optional" /></label>
            <label><span>Source Profile</span><input value={draft.sourceProfile} onChange={(event) => updateDraft('sourceProfile', event.target.value)} placeholder="Required for assume-role" /></label>
            <label><span>Default Region</span><input value={draft.defaultRegion} onChange={(event) => updateDraft('defaultRegion', event.target.value)} /></label>
          </div>
          <div className="svc-btn-row">
            <button type="button" className="svc-btn primary" disabled={busyId === 'save-target'} onClick={() => void handleSaveTarget()}>
              {editingTargetId ? 'Save Changes' : 'Save Target'}
            </button>
            <button
              type="button"
              className="svc-btn success"
              disabled={busyId === draft.label}
              onClick={() => void handleAssume({
                label: draft.label || draft.roleArn,
                roleArn: draft.roleArn,
                sessionName: draft.defaultSessionName,
                externalId: draft.externalId || undefined,
                sourceProfile: draft.sourceProfile || undefined,
                region: draft.defaultRegion || undefined
              })}
            >
              Assume Now
            </button>
            {editingTargetId && (
              <button
                type="button"
                className="svc-btn"
                onClick={() => {
                  setEditingTargetId('')
                  setDraft(emptyDraft(connectionState.selectedProfile?.name ?? connectionState.profile, connectionState.region))
                }}
              >
                Cancel
              </button>
            )}
          </div>
        </div>

        <div className="svc-panel">
          <h3>Saved Targets</h3>
          {connectionState.targets.length === 0 ? (
            <p>No saved assume-role targets yet.</p>
          ) : (
            <div className="svc-list">
              {connectionState.targets.map((target) => (
                <div key={target.id} className="svc-list-item">
                  <div>
                    <strong>{target.label}</strong>
                    <div>{target.roleArn}</div>
                    <div>Profile: {target.sourceProfile || '-'} · Region: {target.defaultRegion || '-'}</div>
                  </div>
                  <div className="svc-btn-row">
                    <button type="button" className="svc-btn success" disabled={busyId === target.id} onClick={() => void handleAssumeTarget(target)}>Assume</button>
                    <button type="button" className="svc-btn" onClick={() => loadTargetIntoForm(target)}>Edit</button>
                    <button type="button" className="svc-btn danger" disabled={busyId === target.id} onClick={() => void handleDeleteTarget(target.id)}>Delete</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="svc-panel" style={{ marginTop: 12 }}>
        <h3>Assumed Sessions</h3>
        {connectionState.sessions.length === 0 ? (
          <p>No assumed sessions in memory.</p>
        ) : (
          <div className="svc-list">
            {connectionState.sessions.map((session) => (
              <div key={session.id} className="svc-list-item">
                <div>
                  <strong>{session.label}</strong>
                  <div>{session.assumedRoleArn || session.roleArn}</div>
                  <div>Account: {session.accountId || '-'} · Key: {session.accessKeyId || '-'}</div>
                  <div>Source profile: {session.sourceProfile || '-'} · Region: {session.region}</div>
                  <div>Status: {session.status} · Expires: {formatDateTime(session.expiration)} ({formatCountdown(session.expiration)})</div>
                </div>
                <div className="svc-btn-row">
                  <button type="button" className="svc-btn primary" disabled={session.status !== 'active'} onClick={() => connectionState.activateSession(session.id)}>Activate</button>
                  <button type="button" className="svc-btn" disabled={session.status !== 'active'} onClick={() => onOpenTerminal(buildSessionConnection(session))}>Terminal</button>
                  <button
                    type="button"
                    className="svc-btn success"
                    disabled={busyId === session.id}
                    onClick={() => void handleAssume({
                      label: session.label,
                      roleArn: session.roleArn,
                      sessionName: session.label.replace(/\s+/g, '-').toLowerCase(),
                      externalId: session.externalId || undefined,
                      sourceProfile: session.sourceProfile || undefined,
                      region: session.region
                    })}
                  >
                    Re-Assume
                  </button>
                  <button type="button" className="svc-btn danger" disabled={busyId === session.id} onClick={() => void handleDeleteSession(session.id)}>Forget</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="svc-panel" style={{ marginTop: 12 }}>
        <h3>Account Comparison</h3>
        <div className="svc-form">
          <label>
            <span>Left Context</span>
            <select value={compareLeft} onChange={(event) => setCompareLeft(event.target.value)}>
              {compareOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
            </select>
          </label>
          <label>
            <span>Right Context</span>
            <select value={compareRight} onChange={(event) => setCompareRight(event.target.value)}>
              <option value="">Select…</option>
              {compareOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
            </select>
          </label>
        </div>
        <div className="svc-btn-row">
          <button type="button" className="svc-btn primary" disabled={compareBusy} onClick={() => void handleCompare()}>Compare</button>
        </div>
        {compareResults && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
            {compareResults.map((result) => (
              <div key={result.option.id} className="svc-panel">
                <h4>{result.option.label}</h4>
                <div className="svc-kv">
                  <div className="svc-kv-row"><div className="svc-kv-label">Account</div><div className="svc-kv-value">{result.identity.account}</div></div>
                  <div className="svc-kv-row"><div className="svc-kv-label">ARN</div><div className="svc-kv-value">{result.identity.arn}</div></div>
                </div>
                <div className="svc-kv" style={{ marginTop: 10 }}>
                  {result.statistics.stats.slice(0, 6).map((stat) => (
                    <div key={`${result.option.id}-${stat.label}`} className="svc-kv-row">
                      <div className="svc-kv-label">{stat.label}</div>
                      <div className="svc-kv-value">{stat.value}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
