import { useEffect, useState } from 'react'

import type { AppReleaseInfo, AppSettings, AwsProfile, AwsRegionOption, EnvironmentHealthReport } from '@shared/types'

type SettingsPageProps = {
  appSettings: AppSettings | null
  profiles: AwsProfile[]
  regions: AwsRegionOption[]
  releaseInfo: AppReleaseInfo | null
  releaseStateLabel: string
  releaseStateTone: string
  environmentHealth: EnvironmentHealthReport | null
  environmentBusy: boolean
  settingsMessage: string
  onUpdateGeneralSettings: (update: AppSettings['general']) => void
  onCheckForUpdates: () => void
  onDownloadUpdate: () => void
  onInstallUpdate: () => void
  onOpenReleasePage: () => void
  onRefreshEnvironment: () => void
}

const GENERAL_LAUNCH_SCREEN_OPTIONS: Array<{ value: AppSettings['general']['launchScreen']; label: string }> = [
  { value: 'profiles', label: 'Profile catalog' },
  { value: 'settings', label: 'Settings' },
  { value: 'session-hub', label: 'Session Hub' },
  { value: 'terraform', label: 'Terraform' },
  { value: 'overview', label: 'Overview' }
]

function summarizeValue(value: string, fallback: string): string {
  return value.trim() ? value : fallback
}

function summarizeRefreshInterval(seconds: number): string {
  if (seconds <= 0) {
    return 'Disabled'
  }

  if (seconds < 60) {
    return `${seconds}s`
  }

  if (seconds % 60 === 0) {
    return `${seconds / 60}m`
  }

  return `${seconds}s`
}

function summarizeToolchain(settings: AppSettings | null): Array<{ label: string; value: string; detail: string }> {
  if (!settings) {
    return [
      { label: 'Preferred CLI', value: 'Loading', detail: 'Settings contract is ready. Toolchain controls land in the next slices.' },
      { label: 'Path overrides', value: 'Pending', detail: 'Terraform, OpenTofu, kubectl, Docker, and AWS CLI overrides will be editable from here.' }
    ]
  }

  const overrides = [
    settings.toolchain.terraformPathOverride,
    settings.toolchain.opentofuPathOverride,
    settings.toolchain.awsCliPathOverride,
    settings.toolchain.kubectlPathOverride,
    settings.toolchain.dockerPathOverride
  ].filter((value) => value.trim())

  return [
    {
      label: 'Preferred CLI',
      value: settings.toolchain.preferredTerraformCliKind || 'Auto detect',
      detail: 'Terraform family selection is now modeled centrally and can be bound to the existing CLI detection flow.'
    },
    {
      label: 'Path overrides',
      value: overrides.length > 0 ? `${overrides.length} configured` : 'None',
      detail: 'Per-tool path overrides are prepared in state even before the edit controls are enabled.'
    }
  ]
}

function summarizeSecurity(): Array<{ label: string; value: string; detail: string }> {
  return [
    {
      label: 'Vault and secrets',
      value: 'Connected',
      detail: 'Security actions will consolidate local vault status, stored secret types, and rotation-oriented support actions.'
    },
    {
      label: 'Access mode',
      value: 'Prepared',
      detail: 'Read-only and operator mode controls will move into this surface with clearer guardrail messaging.'
    }
  ]
}

function SummaryCard({
  eyebrow,
  title,
  rows
}: {
  eyebrow: string
  title: string
  rows: Array<{ label: string; value: string; detail?: string }>
}): JSX.Element {
  return (
    <section className="settings-panel-card">
      <div className="settings-panel-card__header">
        <div>
          <div className="eyebrow">{eyebrow}</div>
          <h3>{title}</h3>
        </div>
      </div>
      <div className="settings-summary-list">
        {rows.map((row) => (
          <div key={row.label} className="settings-summary-row">
            <div>
              <strong>{row.label}</strong>
              {row.detail && <p>{row.detail}</p>}
            </div>
            <span>{row.value}</span>
          </div>
        ))}
      </div>
    </section>
  )
}

export function SettingsPage({
  appSettings,
  profiles,
  regions,
  releaseInfo,
  releaseStateLabel,
  releaseStateTone,
  environmentHealth,
  environmentBusy,
  settingsMessage,
  onUpdateGeneralSettings,
  onCheckForUpdates,
  onDownloadUpdate,
  onInstallUpdate,
  onOpenReleasePage,
  onRefreshEnvironment
}: SettingsPageProps): JSX.Element {
  const buildChannel = releaseInfo?.currentBuild.channel ?? 'unknown'
  const latestRelease = releaseInfo?.latestRelease
  const releaseNotesPreview = latestRelease?.notes?.trim() ?? ''
  const [generalDraft, setGeneralDraft] = useState<AppSettings['general']>({
    defaultProfileName: '',
    defaultRegion: 'us-east-1',
    launchScreen: 'profiles'
  })

  useEffect(() => {
    if (!appSettings) {
      return
    }

    setGeneralDraft(appSettings.general)
  }, [appSettings])

  return (
    <section className="settings-page">
      <div className="settings-page-header">
        <div>
          <div className="eyebrow">Settings</div>
          <h2>Control Center</h2>
          <p className="hero-path">Application behavior, toolchain defaults, update flow, and security posture now share one structured settings surface.</p>
        </div>
        <div className="settings-page-header__meta">
          <span className={`settings-status-pill settings-status-pill-${buildChannel}`}>{buildChannel}</span>
          <span className={`settings-status-pill ${releaseStateTone}`}>{releaseStateLabel}</span>
        </div>
      </div>

      {settingsMessage && <div className="success-banner">{settingsMessage}</div>}

      <section className="settings-panel-card settings-panel-card-wide">
        <div className="settings-panel-card__header">
          <div>
            <div className="eyebrow">General</div>
            <h3>Startup defaults</h3>
          </div>
        </div>
        <div className="settings-general-form">
          <label className="field compact">
            <span>Default profile</span>
            <select
              value={generalDraft.defaultProfileName}
              onChange={(event) => setGeneralDraft((current) => ({ ...current, defaultProfileName: event.target.value }))}
              disabled={!appSettings}
            >
              <option value="">Follow manual selection</option>
              {profiles.map((profile) => (
                <option key={profile.name} value={profile.name}>{profile.name}</option>
              ))}
            </select>
          </label>

          <label className="field compact">
            <span>Default region</span>
            <select
              value={generalDraft.defaultRegion}
              onChange={(event) => setGeneralDraft((current) => ({ ...current, defaultRegion: event.target.value }))}
              disabled={!appSettings}
            >
              {regions.map((region) => (
                <option key={region.id} value={region.id}>{region.id} · {region.name}</option>
              ))}
              {!regions.some((region) => region.id === generalDraft.defaultRegion) && (
                <option value={generalDraft.defaultRegion}>{generalDraft.defaultRegion}</option>
              )}
            </select>
          </label>

          <label className="field compact">
            <span>Launch screen</span>
            <select
              value={generalDraft.launchScreen}
              onChange={(event) => setGeneralDraft((current) => ({ ...current, launchScreen: event.target.value as AppSettings['general']['launchScreen'] }))}
              disabled={!appSettings}
            >
              {GENERAL_LAUNCH_SCREEN_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="settings-action-row">
          <button type="button" className="accent" disabled={!appSettings} onClick={() => onUpdateGeneralSettings(generalDraft)}>
            Save startup defaults
          </button>
        </div>
      </section>

      <div className="settings-section-grid">
        <SummaryCard
          eyebrow="General"
          title="Workspace defaults"
          rows={[
            {
              label: 'Default profile',
              value: summarizeValue(appSettings?.general.defaultProfileName ?? '', 'Follow active selection'),
              detail: 'Profile, region, and launch target are now grouped under one preference bucket.'
            },
            {
              label: 'Default region',
              value: summarizeValue(appSettings?.general.defaultRegion ?? '', 'us-east-1'),
              detail: 'This will replace scattered startup defaults and local storage fallbacks.'
            },
            {
              label: 'Launch screen',
              value: appSettings?.general.launchScreen ?? 'profiles',
              detail: 'The initial landing screen is modeled and ready to drive startup navigation.'
            }
          ]}
        />

        <SummaryCard
          eyebrow="Terminal"
          title="Operator shell behavior"
          rows={[
            {
              label: 'Auto open',
              value: appSettings?.terminal.autoOpen ? 'Enabled' : 'Disabled',
              detail: 'Terminal launch behavior will move behind a first-class setting instead of ad hoc screen flows.'
            },
            {
              label: 'Default command',
              value: summarizeValue(appSettings?.terminal.defaultCommand ?? '', 'No preset'),
              detail: 'Prepared for common bootstrap commands and shell-specific launch helpers.'
            },
            {
              label: 'Shell / font',
              value: `${appSettings?.terminal.shellPreference || 'system'} / ${appSettings?.terminal.fontSize ?? 13}px`,
              detail: 'Shell preference and terminal readability controls are now part of the same contract.'
            }
          ]}
        />

        <SummaryCard
          eyebrow="Refresh"
          title="Data collection policy"
          rows={[
            {
              label: 'Auto refresh',
              value: summarizeRefreshInterval(appSettings?.refresh.autoRefreshIntervalSeconds ?? 0),
              detail: 'Refresh cadence is prepared as an explicit preference rather than an implicit screen behavior.'
            },
            {
              label: 'Heavy screens',
              value: appSettings?.refresh.heavyScreenMode ?? 'manual',
              detail: 'Manual versus automatic refresh for expensive consoles will hang off this switch.'
            }
          ]}
        />

        <SummaryCard
          eyebrow="Toolchain"
          title="CLI routing"
          rows={summarizeToolchain(appSettings)}
        />
      </div>

      <div className="settings-panel-grid">
        <section className="settings-panel-card">
          <div className="settings-panel-card__header">
            <div>
              <div className="eyebrow">Build</div>
              <h3>Current build</h3>
            </div>
            <span className={`settings-status-pill settings-status-pill-${buildChannel}`}>{buildChannel}</span>
          </div>
          <div className="settings-info-grid">
            <div className="settings-info-row"><span>Version</span><strong>{releaseInfo?.currentVersion ? `v${releaseInfo.currentVersion}` : 'Unknown'}</strong></div>
            <div className="settings-info-row"><span>Build hash</span><strong>{releaseInfo?.currentBuild.buildHash ?? 'Unavailable'}</strong></div>
            <div className="settings-info-row"><span>Updater</span><strong>{releaseInfo?.supportsAutoUpdate ? 'Enabled in packaged app' : 'Available in packaged app only'}</strong></div>
            <div className="settings-info-row"><span>Check status</span><strong>{releaseInfo?.checkStatus ?? 'idle'}</strong></div>
            <div className="settings-info-row"><span>Update status</span><strong>{releaseInfo?.updateStatus ?? 'idle'}</strong></div>
            <div className="settings-info-row"><span>Last checked</span><strong>{releaseInfo?.checkedAt ? new Date(releaseInfo.checkedAt).toLocaleString() : releaseInfo?.supportsAutoUpdate ? 'Not checked yet' : 'Disabled in dev build'}</strong></div>
          </div>
        </section>

        <section className="settings-panel-card">
          <div className="settings-panel-card__header">
            <div>
              <div className="eyebrow">Updates</div>
              <h3>Release state</h3>
            </div>
            <span className={`settings-status-pill ${releaseStateTone}`}>
              {releaseStateLabel}
            </span>
          </div>
          <div className="settings-info-grid">
            <div className="settings-info-row"><span>Channel preference</span><strong>{appSettings?.updates.releaseChannel ?? 'system'}</strong></div>
            <div className="settings-info-row"><span>Auto download</span><strong>{appSettings?.updates.autoDownload ? 'Enabled' : 'Disabled'}</strong></div>
            <div className="settings-info-row"><span>Latest version</span><strong>{releaseInfo?.latestVersion ? `v${releaseInfo.latestVersion}` : 'Unavailable'}</strong></div>
            <div className="settings-info-row"><span>Release name</span><strong>{latestRelease?.name ?? 'Unavailable'}</strong></div>
            <div className="settings-info-row"><span>Published</span><strong>{latestRelease?.publishedAt ? new Date(latestRelease.publishedAt).toLocaleString() : 'Unavailable'}</strong></div>
            <div className="settings-info-row"><span>Download progress</span><strong>{typeof releaseInfo?.downloadProgressPercent === 'number' ? `${Math.round(releaseInfo.downloadProgressPercent)}%` : 'Not downloading'}</strong></div>
          </div>
          <div className="settings-action-row">
            <button type="button" className="accent" disabled={!releaseInfo?.canCheckForUpdates} onClick={onCheckForUpdates}>
              {releaseInfo?.supportsAutoUpdate ? (releaseInfo?.checkStatus === 'checking' ? 'Checking...' : 'Check for updates') : 'Package app to enable'}
            </button>
            <button type="button" disabled={!releaseInfo?.canDownloadUpdate} onClick={onDownloadUpdate}>
              {releaseInfo?.updateStatus === 'downloading' ? 'Downloading...' : 'Download update'}
            </button>
            <button type="button" disabled={!releaseInfo?.canInstallUpdate} onClick={onInstallUpdate}>
              Install update
            </button>
            <button type="button" onClick={onOpenReleasePage}>
              Open release page
            </button>
          </div>
          {releaseInfo?.error && <div className="error-banner">{releaseInfo.error}</div>}
        </section>
      </div>

      <section className="settings-panel-card settings-panel-card-wide">
        <div className="settings-panel-card__header">
          <div>
            <div className="eyebrow">Environment</div>
            <h3>Machine validation</h3>
          </div>
          <div className="settings-action-row">
            <button type="button" className="accent" disabled={environmentBusy} onClick={onRefreshEnvironment}>
              {environmentBusy ? 'Refreshing...' : 'Refresh environment'}
            </button>
          </div>
        </div>
        <div className="settings-environment-summary">
          <strong>{environmentHealth?.summary ?? 'Environment checks have not run yet.'}</strong>
          <span>Status: {environmentHealth?.overallSeverity ?? 'idle'}</span>
          <span>Checked: {environmentHealth?.checkedAt ? new Date(environmentHealth.checkedAt).toLocaleString() : 'Not checked yet'}</span>
        </div>
        <div className="settings-environment-grid">
          <div className="settings-environment-section">
            <div className="eyebrow">Tooling</div>
            {environmentHealth?.tools.map((tool) => (
              <div key={tool.id} className="settings-environment-row">
                <div>
                  <strong>{tool.label}</strong>
                  <p>{tool.detail}</p>
                  {tool.remediation && <small>{tool.remediation}</small>}
                </div>
                <div className="settings-environment-meta">
                  <span className={`settings-status-pill settings-status-pill-${tool.status === 'available' ? 'stable' : tool.status === 'missing' ? 'preview' : 'unknown'}`}>{tool.status}</span>
                  <code>{tool.version || 'not found'}</code>
                </div>
              </div>
            ))}
            {!environmentHealth && !environmentBusy && <div className="settings-release-notes"><p>No environment report loaded yet.</p></div>}
          </div>
          <div className="settings-environment-section">
            <div className="eyebrow">Permissions</div>
            {environmentHealth?.permissions.map((item) => (
              <div key={item.id} className="settings-environment-row">
                <div>
                  <strong>{item.label}</strong>
                  <p>{item.detail}</p>
                  {item.remediation && <small>{item.remediation}</small>}
                </div>
                <div className="settings-environment-meta">
                  <span className={`settings-status-pill settings-status-pill-${item.status === 'ok' ? 'stable' : item.status === 'error' ? 'preview' : 'unknown'}`}>{item.status}</span>
                </div>
              </div>
            ))}
            {!environmentHealth && !environmentBusy && <div className="settings-release-notes"><p>No permission report loaded yet.</p></div>}
          </div>
        </div>
      </section>

      <div className="settings-section-grid">
        <SummaryCard
          eyebrow="Security"
          title="Vault and access posture"
          rows={summarizeSecurity()}
        />

        <section className="settings-panel-card">
          <div className="settings-panel-card__header">
            <div>
              <div className="eyebrow">Release Notes</div>
              <h3>Latest published notes</h3>
            </div>
          </div>
          <div className="settings-release-notes">
            {releaseNotesPreview
              ? <pre>{releaseNotesPreview}</pre>
              : <p>No release notes are available yet for the currently resolved release metadata.</p>}
          </div>
        </section>
      </div>
    </section>
  )
}
