// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../App'

type ElectronMock = ElectronAPI & {
  selectPDF: ReturnType<typeof vi.fn>
  saveSettings: ReturnType<typeof vi.fn>
  getSettings: ReturnType<typeof vi.fn>
  analyzePaper: ReturnType<typeof vi.fn>
  cancelAnalysis: ReturnType<typeof vi.fn>
  downloadCoreCode: ReturnType<typeof vi.fn>
  onAnalysisProgress: ReturnType<typeof vi.fn>
  onSummaryChunk: ReturnType<typeof vi.fn>
}

function createDeferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

function createElectronMock(): ElectronMock {
  let progressCallback: ((progress: { stage: string; message: string }) => void) | null = null
  let summaryCallback: ((chunk: string) => void) | null = null

  const api = {
    selectPDF: vi.fn().mockResolvedValue('C:\\papers\\paper.pdf'),
    saveSettings: vi.fn().mockResolvedValue(true),
    getSettings: vi.fn().mockResolvedValue({
      apiKey: 'key',
      provider: 'deepseek',
      model: 'deepseek-v4-flash',
      language: 'en-US',
    }),
    analyzePaper: vi.fn(),
    cancelAnalysis: vi.fn().mockResolvedValue(true),
    downloadCoreCode: vi.fn().mockResolvedValue({ ok: true, path: 'out' }),
    onAnalysisProgress: vi.fn((callback) => {
      progressCallback = callback
      return vi.fn(() => { progressCallback = null })
    }),
    onSummaryChunk: vi.fn((callback) => {
      summaryCallback = callback
      return vi.fn(() => { summaryCallback = null })
    }),
    emitProgress(progress: { stage: string; message: string }) {
      progressCallback?.(progress)
    },
    emitSummary(chunk: string) {
      summaryCallback?.(chunk)
    },
  }

  return api as unknown as ElectronMock
}

describe('App analysis flow', () => {
  let electronAPI: ElectronMock & {
    emitProgress: (progress: { stage: string; message: string }) => void
    emitSummary: (chunk: string) => void
  }

  beforeEach(() => {
    localStorage.clear()
    electronAPI = createElectronMock() as typeof electronAPI
    Object.defineProperty(window, 'electronAPI', {
      configurable: true,
      value: electronAPI,
    })
    vi.spyOn(window, 'getComputedStyle').mockReturnValue({
      paddingLeft: '0px',
      paddingRight: '0px',
      getPropertyValue: (property: string) => property === 'padding-left' || property === 'padding-right' ? '0px' : '',
    } as CSSStyleDeclaration)
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(1000)
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(760)
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('moves through analysis statuses, renders streamed summary, and shows returned token usage', async () => {
    const user = userEvent.setup()
    const deferred = createDeferred<AnalysisResult | AnalysisError>()
    electronAPI.analyzePaper.mockReturnValue(deferred.promise)

    render(<App />)
    await screen.findByText('API Key configured')

    await user.click(screen.getByRole('button', { name: /Select PDF/ }))
    expect(await screen.findByText('paper.pdf')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Start Analysis/ }))
    expect(electronAPI.analyzePaper).toHaveBeenCalledWith('C:\\papers\\paper.pdf')
    expect(screen.getByText(/Status: Parsing/)).toBeInTheDocument()

    act(() => {
      electronAPI.emitProgress({ stage: 'parsing', message: 'Reading PDF...' })
      electronAPI.emitProgress({ stage: 'parsing', message: 'Reading PDF...' })
      electronAPI.emitProgress({ stage: 'summarizing', message: 'Calling model...' })
      electronAPI.emitProgress({ stage: 'generating_code', message: 'Checking code scope...' })
      electronAPI.emitProgress({ stage: 'done', message: 'Analysis complete' })
      electronAPI.emitSummary('partial summary')
    })
    expect(screen.getByText(/Status: Calling model/)).toBeInTheDocument()
    expect(screen.getAllByText('Reading PDF...')).toHaveLength(1)
    expect(screen.getByText('Checking code scope...')).toBeInTheDocument()
    expect(screen.getByText('Analysis complete')).toBeInTheDocument()
    expect(screen.getByText('partial summary')).toBeInTheDocument()

    await act(async () => {
      deferred.resolve({
        ok: true,
        result: { summary: 'Final summary', hasCoreCode: false },
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
      })
      await deferred.promise
    })

    await waitFor(() => expect(screen.getByText(/Status: Completed/)).toBeInTheDocument())
    expect(screen.getByText('Final summary')).toBeInTheDocument()
    expect(screen.getByText(/Tokens:/)).toHaveTextContent('15')
  })

  it('accepts a dropped PDF and resets the initial summary checklist', async () => {
    render(<App />)
    await screen.findByText('API Key configured')
    const dropZone = screen.getByText('Drop a research paper here').parentElement!.parentElement!
    const pdf = new File(['pdf'], 'dropped.pdf', { type: 'application/pdf' })
    Object.defineProperty(pdf, 'path', { value: 'C:\\papers\\dropped.pdf' })

    fireEvent.drop(dropZone, { dataTransfer: { files: [pdf] } })

    expect(await screen.findByText('dropped.pdf')).toBeInTheDocument()
    expect(screen.getByText('All set! Click "Start Analysis" above to begin.')).toBeInTheDocument()
  })

  it('keeps the initial PDF state when file selection is cancelled', async () => {
    const user = userEvent.setup()
    electronAPI.selectPDF.mockResolvedValue(null)

    render(<App />)
    await screen.findByText('API Key configured')
    await user.click(screen.getByRole('button', { name: /Select PDF/ }))

    expect(screen.queryByText('paper.pdf')).not.toBeInTheDocument()
    expect(screen.getByText('Attach a research paper')).toBeInTheDocument()
  })

  it('keeps the default language when settings do not include one', async () => {
    electronAPI.getSettings.mockResolvedValue({
      apiKey: 'key',
      provider: 'deepseek',
      model: 'deepseek-v4-flash',
    })

    render(<App />)

    expect(await screen.findByText('API Key 已配置')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '选择 PDF' })).toBeInTheDocument()
  })

  it('calls cancelAnalysis from the analyzing primary action', async () => {
    const user = userEvent.setup()
    const deferred = createDeferred<AnalysisResult | AnalysisError>()
    electronAPI.analyzePaper.mockReturnValue(deferred.promise)

    render(<App />)
    await screen.findByText('API Key configured')
    await user.click(screen.getByRole('button', { name: /Select PDF/ }))
    await user.click(screen.getByRole('button', { name: /Start Analysis/ }))
    await user.click(screen.getByRole('button', { name: /Cancel Analysis/ }))

    expect(electronAPI.cancelAnalysis).toHaveBeenCalledTimes(1)
  })

  it('sets error status and message for failed analysis responses', async () => {
    const user = userEvent.setup()
    electronAPI.analyzePaper.mockResolvedValue({
      ok: false,
      error: { code: 'API_RATE_LIMITED', message: 'API rate limit exceeded', detail: 'Retry after 60 seconds' },
      usage: { promptTokens: 7, completionTokens: 3, totalTokens: 10 },
    })

    render(<App />)
    await screen.findByText('API Key configured')
    await user.click(screen.getByRole('button', { name: /Select PDF/ }))
    await user.click(screen.getByRole('button', { name: /Start Analysis/ }))

    await waitFor(() => expect(screen.getByText(/Status: Failed/)).toBeInTheDocument())
    expect(screen.getByText(/API rate limit exceeded/)).toBeInTheDocument()
    expect(screen.getByText(/Retry after 60 seconds/)).toBeInTheDocument()
    expect(screen.getByText(/Tokens:/)).toHaveTextContent('10')
  })

  it('shows failed responses without optional detail or token usage', async () => {
    const user = userEvent.setup()
    electronAPI.analyzePaper.mockResolvedValue({
      ok: false,
      error: { code: 'API_RESPONSE_INVALID', message: 'Invalid model response' },
    })

    render(<App />)
    await screen.findByText('API Key configured')
    await user.click(screen.getByRole('button', { name: /Select PDF/ }))
    await user.click(screen.getByRole('button', { name: /Start Analysis/ }))

    await waitFor(() => expect(screen.getByText(/Status: Failed/)).toBeInTheDocument())
    expect(screen.getByText('Invalid model response')).toBeInTheDocument()
    expect(screen.getByText(/No token usage yet/)).toBeInTheDocument()
  })

  it('sets error status when analyzePaper rejects', async () => {
    const user = userEvent.setup()
    electronAPI.analyzePaper.mockRejectedValue(new Error('IPC failed'))

    render(<App />)
    await screen.findByText('API Key configured')
    await user.click(screen.getByRole('button', { name: /Select PDF/ }))
    await user.click(screen.getByRole('button', { name: /Start Analysis/ }))

    await waitFor(() => expect(screen.getByText(/Status: Failed/)).toBeInTheDocument())
    expect(screen.getByText('IPC failed')).toBeInTheDocument()
  })

  it('handles generated-code completion dialog and download errors', async () => {
    const user = userEvent.setup()
    electronAPI.analyzePaper.mockResolvedValue({
      ok: true,
      result: { summary: 'Generated code summary', hasCoreCode: true },
    })
    electronAPI.downloadCoreCode.mockResolvedValue({ ok: false, error: 'No code cache' })

    render(<App />)
    await screen.findByText('API Key configured')
    await user.click(screen.getByRole('button', { name: /Select PDF/ }))
    await user.click(screen.getByRole('button', { name: /Start Analysis/ }))

    expect(await screen.findByText('Execution complete')).toBeInTheDocument()
    expect(screen.getByText(/componentized code project have been generated/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Close' }))
    await waitFor(() => expect(screen.queryByText('Execution complete')).not.toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: /Download Core Code/ }))
    expect(electronAPI.downloadCoreCode).toHaveBeenCalledTimes(1)
    expect(await screen.findByText('No code cache')).toBeInTheDocument()
  })

  it('downloads generated core code without showing an error when export succeeds', async () => {
    const user = userEvent.setup()
    electronAPI.analyzePaper.mockResolvedValue({
      ok: true,
      result: { summary: 'Generated code summary', hasCoreCode: true },
    })
    electronAPI.downloadCoreCode.mockResolvedValue({ ok: true, path: 'C:\\exports\\paper-core-code' })

    render(<App />)
    await screen.findByText('API Key configured')
    await user.click(screen.getByRole('button', { name: /Select PDF/ }))
    await user.click(screen.getByRole('button', { name: /Start Analysis/ }))
    await user.click(await screen.findByRole('button', { name: 'Close' }))

    await user.click(screen.getByRole('button', { name: /Download Core Code/ }))

    expect(electronAPI.downloadCoreCode).toHaveBeenCalledTimes(1)
    expect(screen.queryByText(/No code cache/)).not.toBeInTheDocument()
  })

  it('persists language changes from the header controls', async () => {
    const user = userEvent.setup()

    render(<App />)
    await screen.findByText('API Key configured')

    await user.click(screen.getByRole('button', { name: '中文' }))
    expect(electronAPI.saveSettings).toHaveBeenCalledWith({ language: 'zh-CN' })

    await user.click(screen.getByRole('button', { name: 'EN' }))
    expect(electronAPI.saveSettings).toHaveBeenCalledWith({ language: 'en-US' })
  })
})
