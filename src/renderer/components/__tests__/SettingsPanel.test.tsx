// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import SettingsPanel from '../SettingsPanel'

type Settings = Awaited<ReturnType<ElectronAPI['getSettings']>>

const baseSettings: Settings = {
  apiKey: '',
  provider: 'deepseek',
  model: 'deepseek-v4-flash',
  language: 'en-US',
}

function installElectronAPI(settings: Settings = baseSettings) {
  const api = {
    getSettings: vi.fn().mockResolvedValue(settings),
    saveSettings: vi.fn().mockResolvedValue(true),
    selectPDF: vi.fn(),
    analyzePaper: vi.fn(),
    cancelAnalysis: vi.fn(),
    downloadCoreCode: vi.fn(),
    onAnalysisProgress: vi.fn(),
    onSummaryChunk: vi.fn(),
  } as unknown as ElectronAPI

  window.electronAPI = api
  return api
}

function renderSettingsPanel(settings: Settings = baseSettings) {
  const api = installElectronAPI(settings)
  const onApiKeyConfiguredChange = vi.fn()

  return {
    ...render(
      <SettingsPanel
        language='en-US'
        onApiKeyConfiguredChange={onApiKeyConfiguredChange}
      />
    ),
    api,
    onApiKeyConfiguredChange,
  }
}

afterEach(() => cleanup())

describe('SettingsPanel', () => {
  beforeEach(() => {
    vi.useRealTimers()
  })

  it('loads missing API key state and keeps save disabled until input is non-empty', async () => {
    const { onApiKeyConfiguredChange } = renderSettingsPanel()

    expect(await screen.findByText('Configuration')).toBeInTheDocument()
    expect(screen.getByText('API Key missing')).toBeInTheDocument()
    expect(screen.getByText('Set your API Key to enable paper analysis')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
    expect(onApiKeyConfiguredChange).toHaveBeenCalledWith(false)
  })

  it('shows configured state, restores the saved key for editing, and cancels editing', async () => {
    const user = userEvent.setup()
    const { api, onApiKeyConfiguredChange } = renderSettingsPanel({
      apiKey: 'sk-existing',
      provider: 'kimi',
      model: 'kimi-k2.5',
      language: 'en-US',
    })

    expect(await screen.findByText('API Key configured')).toBeInTheDocument()
    expect(onApiKeyConfiguredChange).toHaveBeenCalledWith(true)

    await user.click(screen.getByRole('button', { name: 'Change Configuration' }))

    const input = await screen.findByPlaceholderText('sk-...')
    expect(input).toHaveValue('sk-existing')
    expect(api.getSettings).toHaveBeenCalledTimes(2)

    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByPlaceholderText('sk-...')).not.toBeInTheDocument()
  })

  it('saves the active provider and API key from edit mode', async () => {
    const user = userEvent.setup()
    const { api, onApiKeyConfiguredChange } = renderSettingsPanel()

    const input = await screen.findByPlaceholderText('sk-...')
    await user.type(input, 'sk-test')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(api.saveSettings).toHaveBeenCalledWith({ provider: 'deepseek', apiKey: 'sk-test' })
    expect(onApiKeyConfiguredChange).toHaveBeenLastCalledWith(true)
    expect(screen.getByText('API Key configured')).toBeInTheDocument()
  })

  it('hides the missing-key warning while editing an existing configuration', async () => {
    const user = userEvent.setup()
    renderSettingsPanel({
      apiKey: 'sk-existing',
      provider: 'deepseek',
      model: 'deepseek-v4-flash',
      language: 'en-US',
    })

    await screen.findByText('API Key configured')
    await user.click(screen.getByRole('button', { name: 'Change Configuration' }))

    expect(screen.queryByText('Set your API Key to enable paper analysis')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument()
  })

  it('falls back to the default provider and model for invalid saved values', async () => {
    renderSettingsPanel({
      apiKey: 'sk-existing',
      provider: 'unknown-provider' as Settings['provider'],
      model: 'unknown-model',
      language: 'en-US',
    })

    await screen.findByText('API Key configured')
    const [providerSelect, modelSelect] = screen.getAllByRole('combobox')

    expect(providerSelect).toHaveValue('deepseek')
    expect(modelSelect).toHaveValue('deepseek-v4-flash')
  })

  it('uses the default provider when stored settings omit provider', async () => {
    renderSettingsPanel({
      apiKey: 'sk-existing',
      provider: '' as Settings['provider'],
      model: 'deepseek-v4-pro',
      language: 'en-US',
    })

    await screen.findByText('API Key configured')
    const [providerSelect, modelSelect] = screen.getAllByRole('combobox')

    expect(providerSelect).toHaveValue('deepseek')
    expect(modelSelect).toHaveValue('deepseek-v4-pro')
  })

  it('saves provider changes and reapplies normalized settings from the main process', async () => {
    const user = userEvent.setup()
    const api = installElectronAPI()
    vi.mocked(api.getSettings)
      .mockReset()
      .mockResolvedValueOnce({ apiKey: 'sk-deep', provider: 'deepseek', model: 'deepseek-v4-flash', language: 'en-US' })
      .mockResolvedValueOnce({ apiKey: '', provider: 'kimi', model: 'kimi-k2.6', language: 'en-US' })
    render(
      <SettingsPanel
        language='en-US'
        onApiKeyConfiguredChange={vi.fn()}
      />
    )

    await screen.findByText('API Key configured')
    const [providerSelect, modelSelect] = screen.getAllByRole('combobox')

    await user.selectOptions(providerSelect, 'kimi')

    expect(api.saveSettings).toHaveBeenCalledWith({ provider: 'kimi' })
    await waitFor(() => expect(providerSelect).toHaveValue('kimi'))
    expect(modelSelect).toHaveValue('kimi-k2.6')
    expect(screen.getByText('API Key missing')).toBeInTheDocument()
  })

  it('saves model changes for the selected provider', async () => {
    const user = userEvent.setup()
    const { api } = renderSettingsPanel({
      apiKey: 'sk-kimi',
      provider: 'kimi',
      model: 'kimi-k2.6',
      language: 'en-US',
    })

    await screen.findByText('API Key configured')
    const [, modelSelect] = screen.getAllByRole('combobox')

    await user.selectOptions(modelSelect, 'kimi-k2.5')

    expect(api.saveSettings).toHaveBeenCalledWith({ model: 'kimi-k2.5' })
    expect(modelSelect).toHaveValue('kimi-k2.5')
  })
})
