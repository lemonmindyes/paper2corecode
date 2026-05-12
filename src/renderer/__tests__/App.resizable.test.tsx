// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../App'

function installElectronMock() {
  Object.defineProperty(window, 'electronAPI', {
    configurable: true,
    value: {
      selectPDF: vi.fn().mockResolvedValue(null),
      saveSettings: vi.fn().mockResolvedValue(true),
      getSettings: vi.fn().mockResolvedValue({
        apiKey: 'key',
        provider: 'deepseek',
        model: 'deepseek-v4-flash',
        language: 'en-US',
      }),
      analyzePaper: vi.fn(),
      cancelAnalysis: vi.fn().mockResolvedValue(true),
      downloadCoreCode: vi.fn(),
      onAnalysisProgress: vi.fn(() => vi.fn()),
      onSummaryChunk: vi.fn(() => vi.fn()),
    } satisfies ElectronAPI,
  })
}

describe('App resizable layout', () => {
  beforeEach(() => {
    localStorage.clear()
    installElectronMock()
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

  it('initializes panel sizes from localStorage', async () => {
    localStorage.setItem('paper2corecode.sidebarWidth', '340')
    localStorage.setItem('paper2corecode.uploadHeight', '310')

    render(<App />)
    await screen.findByText('API Key configured')

    const sidebarHandle = screen.getByLabelText('Resize sidebar')
    const appBody = sidebarHandle.parentElement as HTMLElement
    const uploadHandle = screen.getByLabelText('Resize upload and summary panels')
    const mainContent = uploadHandle.parentElement as HTMLElement

    await waitFor(() => {
      expect(appBody.style.gridTemplateColumns).toContain('340px')
      expect(mainContent.style.gridTemplateRows).toContain('310px')
    })
  })

  it('clamps stored panel sizes to the available viewport on mount', async () => {
    localStorage.setItem('paper2corecode.sidebarWidth', '420')
    localStorage.setItem('paper2corecode.uploadHeight', '420')
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(700)
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(500)

    render(<App />)
    await screen.findByText('API Key configured')

    const sidebarHandle = screen.getByLabelText('Resize sidebar')
    const appBody = sidebarHandle.parentElement as HTMLElement
    const uploadHandle = screen.getByLabelText('Resize upload and summary panels')
    const mainContent = uploadHandle.parentElement as HTMLElement

    await waitFor(() => {
      expect(appBody.style.gridTemplateColumns).toContain('220px')
      expect(mainContent.style.gridTemplateRows).toContain('230px')
    })
  })

  it('updates and persists sidebar width during drag', async () => {
    render(<App />)
    await screen.findByText('API Key configured')

    const sidebarHandle = screen.getByLabelText('Resize sidebar')
    const appBody = sidebarHandle.parentElement as HTMLElement

    fireEvent.pointerDown(sidebarHandle, { clientX: 280 })
    fireEvent.pointerMove(window, { clientX: 360 })
    fireEvent.pointerUp(window, { clientX: 360 })

    expect(appBody.style.gridTemplateColumns).toContain('360px')
    expect(localStorage.getItem('paper2corecode.sidebarWidth')).toBe('360')
    expect(document.body).not.toHaveClass('is-resizing-layout')
  })

  it('updates and persists upload height during drag', async () => {
    render(<App />)
    await screen.findByText('API Key configured')

    const uploadHandle = screen.getByLabelText('Resize upload and summary panels')
    const mainContent = uploadHandle.parentElement as HTMLElement

    fireEvent.pointerDown(uploadHandle, { clientY: 260 })
    fireEvent.pointerMove(window, { clientY: 330 })
    fireEvent.pointerUp(window, { clientY: 330 })

    expect(mainContent.style.gridTemplateRows).toContain('330px')
    expect(localStorage.getItem('paper2corecode.uploadHeight')).toBe('330')
    expect(document.body).not.toHaveClass('is-resizing-layout')
  })

  it('handles pointer cancellation and storage failures during resizing', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota exceeded')
    })
    render(<App />)
    await screen.findByText('API Key configured')

    const sidebarHandle = screen.getByLabelText('Resize sidebar')
    const appBody = sidebarHandle.parentElement as HTMLElement
    fireEvent.pointerDown(sidebarHandle, { clientX: 280 })
    fireEvent.pointerCancel(window, { clientX: 320 })

    expect(appBody.style.gridTemplateColumns).toContain('320px')
    expect(document.body).not.toHaveClass('is-resizing-layout')

    const uploadHandle = screen.getByLabelText('Resize upload and summary panels')
    const mainContent = uploadHandle.parentElement as HTMLElement
    fireEvent.pointerDown(uploadHandle, { clientY: 260 })
    fireEvent.pointerCancel(window, { clientY: 300 })

    expect(mainContent.style.gridTemplateRows).toContain('300px')
    expect(document.body).not.toHaveClass('is-resizing-layout')
  })

  it('clamps dragged sizes to configured bounds', async () => {
    render(<App />)
    await screen.findByText('API Key configured')

    const sidebarHandle = screen.getByLabelText('Resize sidebar')
    const appBody = sidebarHandle.parentElement as HTMLElement
    fireEvent.pointerDown(sidebarHandle, { clientX: 280 })
    fireEvent.pointerUp(window, { clientX: 1000 })
    expect(appBody.style.gridTemplateColumns).toContain('420px')

    const uploadHandle = screen.getByLabelText('Resize upload and summary panels')
    const mainContent = uploadHandle.parentElement as HTMLElement
    fireEvent.pointerDown(uploadHandle, { clientY: 260 })
    fireEvent.pointerUp(window, { clientY: 0 })
    expect(mainContent.style.gridTemplateRows).toContain('230px')
  })
})
