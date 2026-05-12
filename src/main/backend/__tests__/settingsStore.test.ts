import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getActiveSettings, PROVIDER_SETTINGS, saveSettingsPatch } from '../settingsStore'

const getPathMock = vi.hoisted(() => vi.fn())

vi.mock('electron', () => ({
  app: {
    getPath: getPathMock,
  },
}))

let tempDir: string

function configPath() {
  return path.join(tempDir, 'config.json')
}

function writeConfig(value: unknown) {
  fs.writeFileSync(configPath(), JSON.stringify(value), 'utf-8')
}

function readStoredConfig() {
  return JSON.parse(fs.readFileSync(configPath(), 'utf-8'))
}

describe('settingsStore', () => {
  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'p2cc-settings-'))
    getPathMock.mockReturnValue(tempDir)
  })

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true })
    vi.clearAllMocks()
  })

  it('returns default active settings when no config exists', () => {
    expect(getActiveSettings()).toEqual({
      apiKey: '',
      provider: 'deepseek',
      model: PROVIDER_SETTINGS.deepseek.defaultModel,
      language: 'zh-CN',
      selectedCodeLanguage: 'Python',
    })
  })

  it('returns default active settings when stored config is not an object', () => {
    writeConfig(['bad-config'])

    expect(getActiveSettings()).toEqual({
      apiKey: '',
      provider: 'deepseek',
      model: PROVIDER_SETTINGS.deepseek.defaultModel,
      language: 'zh-CN',
      selectedCodeLanguage: 'Python',
    })
  })

  it('throws when stored config is invalid JSON', () => {
    fs.writeFileSync(configPath(), '{bad}', 'utf-8')

    expect(() => getActiveSettings()).toThrow(SyntaxError)
  })

  it('normalizes legacy config with global apiKey and model', () => {
    writeConfig({
      provider: 'kimi',
      apiKey: 'legacy-key',
      model: 'kimi-k2.5',
      language: 'en-US',
    })

    expect(getActiveSettings()).toEqual({
      apiKey: 'legacy-key',
      provider: 'kimi',
      model: 'kimi-k2.5',
      language: 'en-US',
      selectedCodeLanguage: 'Python',
    })
  })

  it('normalizes and preserves the selected output code language', () => {
    writeConfig({
      provider: 'deepseek',
      selectedCodeLanguage: 'Rust',
      providers: {
        deepseek: { apiKey: 'deep-key', model: 'deepseek-v4-pro' },
      },
    })

    expect(getActiveSettings()).toEqual({
      apiKey: 'deep-key',
      provider: 'deepseek',
      model: 'deepseek-v4-pro',
      language: 'zh-CN',
      selectedCodeLanguage: 'Rust',
    })
  })

  it('falls back invalid stored provider, language, and model safely', () => {
    writeConfig({
      provider: 'unknown-provider',
      language: 'fr-FR',
      providers: {
        deepseek: { apiKey: 'deep-key', model: 'invalid-model' },
      },
    })

    expect(getActiveSettings()).toEqual({
      apiKey: 'deep-key',
      provider: 'deepseek',
      model: PROVIDER_SETTINGS.deepseek.defaultModel,
      language: 'zh-CN',
      selectedCodeLanguage: 'Python',
    })
  })

  it('falls back invalid stored output code languages to Python', () => {
    writeConfig({
      provider: 'deepseek',
      selectedCodeLanguage: 'TypeScript',
      providers: {
        deepseek: { apiKey: 'deep-key', model: 'deepseek-v4-flash' },
      },
    })

    expect(getActiveSettings()).toMatchObject({
      selectedCodeLanguage: 'Python',
    })
  })

  it('ignores malformed provider records and non-string API keys', () => {
    writeConfig({
      provider: 'kimi',
      language: 'en-US',
      providers: {
        deepseek: 'bad-record',
        kimi: { apiKey: 123, model: 'not-a-model' },
      },
    })

    expect(getActiveSettings()).toEqual({
      apiKey: '',
      provider: 'kimi',
      model: PROVIDER_SETTINGS.kimi.defaultModel,
      language: 'en-US',
      selectedCodeLanguage: 'Python',
    })
  })

  it('keeps legacy global values only when the saved provider and model are valid', () => {
    writeConfig({
      provider: 'glm',
      apiKey: 'legacy-glm-key',
      model: 'glm-5-turbo',
      language: 'en-US',
    })

    expect(getActiveSettings()).toEqual({
      apiKey: 'legacy-glm-key',
      provider: 'glm',
      model: 'glm-5-turbo',
      language: 'en-US',
      selectedCodeLanguage: 'Python',
    })
  })

  it('saves active provider settings and preserves provider-specific keys', () => {
    expect(saveSettingsPatch({ apiKey: 'deep-key', language: 'en-US', selectedCodeLanguage: 'Go' })).toEqual({
      apiKey: 'deep-key',
      provider: 'deepseek',
      model: PROVIDER_SETTINGS.deepseek.defaultModel,
      language: 'en-US',
      selectedCodeLanguage: 'Go',
    })

    expect(saveSettingsPatch({ provider: 'kimi' })).toEqual({
      apiKey: '',
      provider: 'kimi',
      model: PROVIDER_SETTINGS.kimi.defaultModel,
      language: 'en-US',
      selectedCodeLanguage: 'Go',
    })

    expect(saveSettingsPatch({ apiKey: 'kimi-key', model: 'kimi-k2.5' })).toEqual({
      apiKey: 'kimi-key',
      provider: 'kimi',
      model: 'kimi-k2.5',
      language: 'en-US',
      selectedCodeLanguage: 'Go',
    })

    expect(saveSettingsPatch({ provider: 'deepseek' })).toEqual({
      apiKey: 'deep-key',
      provider: 'deepseek',
      model: PROVIDER_SETTINGS.deepseek.defaultModel,
      language: 'en-US',
      selectedCodeLanguage: 'Go',
    })
  })

  it('saves selected output code language patches and normalizes unsupported values', () => {
    expect(saveSettingsPatch({ selectedCodeLanguage: 'MATLAB' })).toMatchObject({
      selectedCodeLanguage: 'MATLAB',
    })

    expect(readStoredConfig().selectedCodeLanguage).toBe('MATLAB')

    expect(saveSettingsPatch({ selectedCodeLanguage: 'CUDA' })).toMatchObject({
      selectedCodeLanguage: 'Python',
    })
  })

  it('resets unsupported model patches to the selected provider default', () => {
    writeConfig({ provider: 'glm', language: 'zh-CN', providers: {} })

    expect(saveSettingsPatch({ model: 'not-a-model' })).toMatchObject({
      provider: 'glm',
      model: PROVIDER_SETTINGS.glm.defaultModel,
    })
  })

  it('throws when saving an unsupported provider patch', () => {
    expect(() => saveSettingsPatch({ provider: 'bad-provider' })).toThrow('Unsupported provider')
    expect(fs.existsSync(configPath())).toBe(false)
  })

  it('writes normalized config with all known providers', () => {
    saveSettingsPatch({ apiKey: 'deep-key' })

    const stored = readStoredConfig()
    expect(stored.provider).toBe('deepseek')
    expect(Object.keys(stored.providers).sort()).toEqual(Object.keys(PROVIDER_SETTINGS).sort())
    expect(stored.providers.deepseek.apiKey).toBe('deep-key')
  })
})
