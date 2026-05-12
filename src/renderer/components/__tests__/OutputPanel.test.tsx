// @vitest-environment jsdom

import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import OutputPanel from '../OutputPanel'
import { cleanup } from '@testing-library/react'

afterEach(() => cleanup())

function renderOutputPanel(overrides: Partial<React.ComponentProps<typeof OutputPanel>> = {}) {
  return render(
    <OutputPanel
      result={null}
      analyzing={false}
      streamingSummary=''
      error={null}
      analysisStatus='idle'
      elapsedTime={0}
      tokenUsage={null}
      apiKeyConfigured={true}
      pdfPath='paper.pdf'
      language='en-US'
      onDownloadCode={vi.fn()}
      {...overrides}
    />
  )
}

describe('OutputPanel', () => {
  it('shows idle status, elapsed time, and unavailable token usage', () => {
    renderOutputPanel()

    expect(screen.getByText(/Status: Waiting/)).toBeInTheDocument()
    expect(screen.getByText(/Elapsed:/)).toHaveTextContent('00:00')
    expect(screen.getByText(/Tokens: No token usage yet/)).toBeInTheDocument()
  })

  it('shows token details when usage is available', () => {
    renderOutputPanel({
      analysisStatus: 'success',
      elapsedTime: 85,
      tokenUsage: { promptTokens: 100, completionTokens: 25, totalTokens: 125 },
    })

    expect(screen.getByText(/Status: Completed/)).toBeInTheDocument()
    expect(screen.getByText('01:25')).toBeInTheDocument()
    expect(screen.getByText(/Tokens:/)).toHaveTextContent('125')
    expect(screen.getByText(/Input tokens:/)).toHaveTextContent('100')
    expect(screen.getByText(/Output tokens:/)).toHaveTextContent('25')
    expect(screen.getByText(/Total tokens:/)).toHaveTextContent('125')
  })

  it('renders streaming summary while analyzing', () => {
    renderOutputPanel({
      analyzing: true,
      analysisStatus: 'analyzing',
      streamingSummary: 'partial summary',
    })

    expect(screen.getByText('Generating summary')).toBeInTheDocument()
    expect(screen.getByText('partial summary')).toBeInTheDocument()
  })

  it('renders completed summary and download action for generated core code', () => {
    renderOutputPanel({
      result: { summary: 'final **summary**', hasCoreCode: true },
    })

    expect(screen.getByText('Analysis completed')).toBeInTheDocument()
    expect(screen.getByText('final')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Download Core Code/ })).toBeInTheDocument()
  })

  it('renders error state', () => {
    renderOutputPanel({
      analysisStatus: 'error',
      error: 'API rate limit exceeded',
    })

    expect(screen.getByText('Could not analyze this paper')).toBeInTheDocument()
    expect(screen.getByText('API rate limit exceeded')).toBeInTheDocument()
    expect(screen.getByText(/Please wait a moment/)).toBeInTheDocument()
  })
})
