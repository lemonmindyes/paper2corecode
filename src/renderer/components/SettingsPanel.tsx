import { useState, useEffect } from 'react'
import { CheckCircle2, AlertCircle, Key } from 'lucide-react'
import { t, Language } from '../i18n'

const PROVIDERS = [
  {
    value: 'deepseek',
    label: 'DeepSeek',
    models: [
      { value: 'deepseek-v4-flash', label: 'V4 Flash' },
      { value: 'deepseek-v4-pro', label: 'V4 Pro' },
    ],
  },
]

const sectionStyle: React.CSSProperties = {
  background: 'var(--color-surface)',
  borderRadius: 'var(--radius-md)',
  padding: 18,
}

const titleStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  color: 'var(--color-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.6px',
  marginBottom: 14,
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '9px 12px',
  fontSize: 14,
  marginBottom: 12,
}

const selectStyle: React.CSSProperties = {
  width: '100%',
  padding: '9px 12px',
  fontSize: 14,
  marginBottom: 12,
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 13,
  fontWeight: 500,
  color: 'var(--color-secondary)',
  marginBottom: 6,
}

const btnStyle: React.CSSProperties = {
  width: '100%',
  padding: '9px 0',
  fontSize: 14,
  fontWeight: 500,
  color: '#fff',
  background: 'var(--color-accent)',
  borderRadius: 'var(--radius-sm)',
}

interface SettingsPanelProps {
  language: Language
  onApiKeyConfiguredChange: (configured: boolean) => void
}

export default function SettingsPanel({
  language,
  onApiKeyConfiguredChange,
}: SettingsPanelProps) {
  const [apiKey, setApiKey] = useState('')
  const [provider, setProvider] = useState(PROVIDERS[0].value)
  const [model, setModel] = useState(PROVIDERS[0].models[0].value)
  const [configured, setConfigured] = useState(false)
  const [editing, setEditing] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    window.electronAPI.getSettings().then((s) => {
      setApiKey(s.apiKey)
      const nextProvider = s.provider || PROVIDERS[0].value
      const providerConfig = PROVIDERS.find((item) => item.value === nextProvider) || PROVIDERS[0]
      const nextModel = providerConfig.models.some((item) => item.value === s.model)
        ? s.model
        : providerConfig.models[0].value

      setProvider(providerConfig.value)
      setModel(nextModel)
      const hasKey = s.apiKey.length > 0
      setConfigured(hasKey)
      setEditing(!hasKey)
      setLoading(false)
    })
  }, [])

  const saveConfig = async (next: { provider?: string; model?: string; apiKey?: string }) => {
    const nextProvider = next.provider ?? provider
    const nextModel = next.model ?? model
    const nextApiKey = next.apiKey ?? apiKey

    await window.electronAPI.saveSettings({
      apiKey: nextApiKey,
      provider: nextProvider,
      model: nextModel,
      language,
    })
  }

  const handleProviderChange = async (nextProvider: string) => {
    const providerConfig = PROVIDERS.find((item) => item.value === nextProvider) || PROVIDERS[0]
    const nextModel = providerConfig.models[0].value

    setProvider(providerConfig.value)
    setModel(nextModel)
    await saveConfig({ provider: providerConfig.value, model: nextModel })
  }

  const handleModelChange = async (nextModel: string) => {
    setModel(nextModel)
    await saveConfig({ model: nextModel })
  }

  const handleSave = async () => {
    const hasKey = apiKey.trim().length > 0
    await saveConfig({ apiKey })
    setSaved(true)
    setConfigured(hasKey)
    setEditing(!hasKey)
    onApiKeyConfiguredChange(hasKey)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleChange = () => {
    window.electronAPI.getSettings().then((s) => {
      setApiKey(s.apiKey)
    })
    setEditing(true)
  }

  const handleCancel = () => {
    setEditing(false)
  }

  if (loading) return null

  const currentProvider = PROVIDERS.find((item) => item.value === provider) || PROVIDERS[0]

  return (
    <div style={sectionStyle}>
      <div style={titleStyle}>{t(language, 'settings.title')}</div>

      <label style={labelStyle}>{t(language, 'settings.provider')}</label>
      <select
        value={provider}
        onChange={(e) => handleProviderChange(e.target.value)}
        style={selectStyle}
      >
        {PROVIDERS.map((item) => (
          <option key={item.value} value={item.value}>{item.label}</option>
        ))}
      </select>

      <label style={labelStyle}>{t(language, 'settings.model')}</label>
      <select
        value={model}
        onChange={(e) => handleModelChange(e.target.value)}
        style={selectStyle}
      >
        {currentProvider.models.map((item) => (
          <option key={item.value} value={item.value}>{item.label}</option>
        ))}
      </select>

      <label style={labelStyle}>{t(language, 'settings.apiKey')}</label>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        {configured
          ? <CheckCircle2 size={16} style={{ color: 'var(--color-success)', flexShrink: 0 }} />
          : <AlertCircle size={16} style={{ color: 'var(--color-warning)', flexShrink: 0 }} />
        }
        <span style={{ fontSize: 14, color: configured ? 'var(--color-success)' : 'var(--color-warning)' }}>
          {configured ? t(language, 'settings.apiKeyConfigured') : t(language, 'settings.apiKeyMissing')}
        </span>
      </div>

      {!editing ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button
            onClick={handleChange}
            style={{
              alignSelf: 'flex-start',
              padding: '6px 14px',
              fontSize: 13,
              fontWeight: 500,
              color: 'var(--color-accent)',
              background: 'transparent',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-sm)',
              marginTop: 2,
            }}
          >
            {configured ? t(language, 'settings.change') : t(language, 'settings.configure')}
          </button>
        </div>
      ) : (
        <div>
          {!configured && (
            <div style={{
              fontSize: 13,
              color: 'var(--color-warning)',
              marginBottom: 12,
              padding: '8px 12px',
              background: 'var(--color-warning-bg)',
              border: '1px solid var(--color-warning-border)',
              borderRadius: 6,
            }}>
              {t(language, 'settings.warning')}
            </div>
          )}

          <label style={labelStyle}>
            <Key size={14} style={{ verticalAlign: 'middle', marginRight: 5 }} />
            {t(language, 'settings.apiKey')}
          </label>
          <input
            type='password'
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder='sk-...'
            style={inputStyle}
          />

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={handleSave}
              disabled={!apiKey.trim()}
              style={{
                ...btnStyle,
                background: saved ? 'var(--color-success)' : 'var(--color-accent)',
                flex: 1,
              }}
            >
              {saved ? t(language, 'settings.saved') : t(language, 'settings.save')}
            </button>
            {configured && (
              <button
                onClick={handleCancel}
                style={{
                  padding: '9px 14px',
                  fontSize: 14,
                  fontWeight: 500,
                  color: 'var(--color-secondary)',
                  background: 'transparent',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-sm)',
                }}
              >
                {t(language, 'settings.cancel')}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
