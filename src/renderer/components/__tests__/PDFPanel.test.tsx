// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import PDFPanel from '../PDFPanel'

afterEach(() => cleanup())

function renderPDFPanel(overrides: Partial<React.ComponentProps<typeof PDFPanel>> = {}) {
  const props: React.ComponentProps<typeof PDFPanel> = {
    pdfPath: null,
    analyzing: false,
    progress: [],
    apiKeyConfigured: true,
    hasResult: false,
    language: 'en-US',
    onSelectPDF: vi.fn(),
    onSetPDFPath: vi.fn(),
    onAnalyze: vi.fn(),
    onCancelAnalyze: vi.fn(),
    ...overrides,
  }

  return { ...render(<PDFPanel {...props} />), props }
}

describe('PDFPanel', () => {
  it('disables analysis until a PDF is selected', () => {
    renderPDFPanel()

    expect(screen.getByRole('button', { name: /Start Analysis/ })).toBeDisabled()
  })

  it('shows API key requirement when a PDF exists but settings are incomplete', () => {
    renderPDFPanel({ pdfPath: 'C:\\papers\\paper.pdf', apiKeyConfigured: false })

    expect(screen.getByRole('button', { name: /API Key required/ })).toBeDisabled()
    expect(screen.getByText('Set API Key in sidebar to start')).toBeInTheDocument()
  })

  it('starts analysis from the action button', async () => {
    const user = userEvent.setup()
    const { props } = renderPDFPanel({ pdfPath: 'C:\\papers\\paper.pdf' })

    await user.click(screen.getByRole('button', { name: /Start Analysis/ }))

    expect(props.onAnalyze).toHaveBeenCalledTimes(1)
  })

  it('switches the primary action to cancel while analyzing', async () => {
    const user = userEvent.setup()
    const { props } = renderPDFPanel({
      pdfPath: 'C:\\papers\\paper.pdf',
      analyzing: true,
      progress: ['Reading PDF file...'],
    })

    expect(screen.getByRole('button', { name: /Select PDF/ })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: /Cancel Analysis/ }))

    expect(props.onCancelAnalyze).toHaveBeenCalledTimes(1)
  })

  it('uses analyze-again wording when previous results exist', () => {
    renderPDFPanel({ pdfPath: 'C:\\papers\\paper.pdf', hasResult: true })

    expect(screen.getByRole('button', { name: /Analyze Again/ })).toBeInTheDocument()
  })

  it('accepts dropped PDF files and ignores non-PDF files', () => {
    const { props } = renderPDFPanel()
    const dropZone = screen.getByText('Drop a research paper here').closest('div')!
    const pdf = new File(['pdf'], 'paper.pdf', { type: 'application/pdf' })
    Object.defineProperty(pdf, 'path', { value: 'C:\\papers\\paper.pdf' })
    const text = new File(['text'], 'paper.txt', { type: 'text/plain' })
    Object.defineProperty(text, 'path', { value: 'C:\\papers\\paper.txt' })

    fireEvent.drop(dropZone, { dataTransfer: { files: [pdf] } })
    fireEvent.drop(dropZone, { dataTransfer: { files: [text] } })

    expect(props.onSetPDFPath).toHaveBeenCalledTimes(1)
    expect(props.onSetPDFPath).toHaveBeenCalledWith('C:\\papers\\paper.pdf')
  })
})
