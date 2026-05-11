import * as fs from 'fs'
import * as path from 'path'
import { app } from 'electron'

export const PROVIDER_SETTINGS: Record<string, { defaultModel: string; models: string[] }> = {
  deepseek: {
    defaultModel: 'deepseek-v4-flash',
    models: ['deepseek-v4-flash', 'deepseek-v4-pro'],
  },
  jiekou: {
    defaultModel: 'claude-opus-4-7',
    models: [
      'claude-opus-4-7',
      'claude-sonnet-4-6',
      'gemini-3.1-flash-lite-preview',
      'gemini-3.1-pro-preview',
      'gpt-5.5-pro',
      'gpt-5.4-pro',
      'gpt-5.5',
      'gpt-5.4-nano',
      'gpt-5.4-mini',
    ],
  },
  minimax: {
    defaultModel: 'MiniMax-M2.7',
    models: [
      'MiniMax-M2.7',
      'MiniMax-M2.7-highspeed',
      'MiniMax-M2.5',
      'MiniMax-M2.5-highspeed',
    ],
  },
  glm: {
    defaultModel: 'glm-5.1',
    models: ['glm-5.1', 'glm-5', 'glm-5-turbo'],
  },
  mimo: {
    defaultModel: 'mimo-v2.5-pro',
    models: ['mimo-v2.5-pro', 'mimo-v2-pro', 'mimo-v2.5'],
  },
}

export interface ActiveSettings {
  apiKey: string
  provider: string
  model: string
  language: string
}

export interface SettingsPatch {
  apiKey?: string
  provider?: string
  model?: string
  language?: string
}

interface ProviderStoredSettings {
  apiKey: string
  model: string
}

interface StoredSettings {
  provider: string
  language: string
  providers: Record<string, ProviderStoredSettings>
}

const DEFAULT_PROVIDER = 'deepseek'
const DEFAULT_LANGUAGE = 'zh-CN'

function getConfigPath(): string {
  return path.join(app.getPath('userData'), 'config.json')
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function isKnownProvider(provider: unknown): provider is string {
  return typeof provider === 'string' && Object.prototype.hasOwnProperty.call(PROVIDER_SETTINGS, provider)
}

function isKnownModel(provider: string, model: unknown): model is string {
  return typeof model === 'string' && PROVIDER_SETTINGS[provider]?.models.includes(model)
}

function normalizeLanguage(language: unknown): string {
  return language === 'en-US' ? 'en-US' : DEFAULT_LANGUAGE
}

function createDefaultSettings(): StoredSettings {
  const providers: Record<string, ProviderStoredSettings> = {}

  for (const [provider, cfg] of Object.entries(PROVIDER_SETTINGS)) {
    providers[provider] = {
      apiKey: '',
      model: cfg.defaultModel,
    }
  }

  return {
    provider: DEFAULT_PROVIDER,
    language: DEFAULT_LANGUAGE,
    providers,
  }
}

function normalizeSettings(raw: unknown): StoredSettings {
  const settings = createDefaultSettings()
  if (!isObject(raw)) return settings

  const selectedProvider = isKnownProvider(raw.provider) ? raw.provider : DEFAULT_PROVIDER
  settings.provider = selectedProvider
  settings.language = normalizeLanguage(raw.language)

  if (isObject(raw.providers)) {
    for (const provider of Object.keys(PROVIDER_SETTINGS)) {
      const storedProvider = raw.providers[provider]
      if (!isObject(storedProvider)) continue

      if (typeof storedProvider.apiKey === 'string') {
        settings.providers[provider].apiKey = storedProvider.apiKey
      }

      if (isKnownModel(provider, storedProvider.model)) {
        settings.providers[provider].model = storedProvider.model
      }
    }
  } else {
    // Legacy config stored apiKey/model globally. Keep that key only for the saved provider.
    if (typeof raw.apiKey === 'string') {
      settings.providers[selectedProvider].apiKey = raw.apiKey
    }

    if (isKnownModel(selectedProvider, raw.model)) {
      settings.providers[selectedProvider].model = raw.model
    }
  }

  return settings
}

function readSettings(): StoredSettings {
  const cfgPath = getConfigPath()
  if (!fs.existsSync(cfgPath)) return createDefaultSettings()

  const raw = fs.readFileSync(cfgPath, 'utf-8')
  return normalizeSettings(JSON.parse(raw))
}

export function getActiveSettings(): ActiveSettings {
  const settings = readSettings()
  const providerSettings = settings.providers[settings.provider]

  return {
    apiKey: providerSettings.apiKey,
    provider: settings.provider,
    model: providerSettings.model,
    language: settings.language,
  }
}

export function saveSettingsPatch(patch: SettingsPatch): ActiveSettings {
  const settings = readSettings()

  if (patch.language !== undefined) {
    settings.language = normalizeLanguage(patch.language)
  }

  if (patch.provider !== undefined) {
    if (!isKnownProvider(patch.provider)) {
      throw new Error(`Unsupported provider: ${patch.provider}`)
    }
    settings.provider = patch.provider
  }

  const targetProvider = settings.provider

  if (patch.model !== undefined) {
    settings.providers[targetProvider].model = isKnownModel(targetProvider, patch.model)
      ? patch.model
      : PROVIDER_SETTINGS[targetProvider].defaultModel
  }

  if (patch.apiKey !== undefined) {
    settings.providers[targetProvider].apiKey = patch.apiKey
  }

  fs.writeFileSync(getConfigPath(), JSON.stringify(settings), 'utf-8')
  return getActiveSettings()
}
