// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react'
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
  it('keeps streaming output pinned unless the user scrolls away from the bottom', () => {
    const requestFrame = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      callback(0)
      return 1
    })
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {})
    vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockReturnValue(500)
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(200)

    const { container, rerender } = renderOutputPanel({
      analyzing: true,
      analysisStatus: 'analyzing',
      streamingSummary: 'first chunk',
    })
    const scroller = Array.from(container.querySelectorAll('div')).find((element) => {
      const style = (element as HTMLElement).style
      return style.overflow === 'auto' && style.padding === '30px 36px'
    }) as HTMLDivElement

    expect(requestFrame).toHaveBeenCalledTimes(1)
    expect(scroller.scrollTop).toBe(500)

    scroller.scrollTop = 0
    fireEvent.scroll(scroller)
    rerender(
      <OutputPanel
        result={null}
        analyzing={true}
        streamingSummary='second chunk'
        error={null}
        analysisStatus='analyzing'
        elapsedTime={0}
        tokenUsage={null}
        apiKeyConfigured={true}
        pdfPath='paper.pdf'
        language='en-US'
        onDownloadCode={vi.fn()}
      />
    )

    expect(requestFrame).toHaveBeenCalledTimes(1)
  })

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
    const onDownloadCode = vi.fn()
    renderOutputPanel({
      result: { summary: 'final **summary**', hasCoreCode: true },
      onDownloadCode,
    })

    expect(screen.getByText('Analysis completed')).toBeInTheDocument()
    expect(screen.getByText('final')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Download Core Code/ }))
    expect(onDownloadCode).toHaveBeenCalledTimes(1)
  })

  it('renders the initial checklist when prerequisites are missing or complete', () => {
    const { rerender } = renderOutputPanel({ apiKeyConfigured: false, pdfPath: null })

    expect(screen.getByText('Ready to analyze a paper?')).toBeInTheDocument()
    expect(screen.getByText('Follow these steps to get started')).toBeInTheDocument()
    expect(screen.getByText('Configure model API')).toBeInTheDocument()
    expect(screen.getByText('Attach a research paper')).toBeInTheDocument()

    rerender(
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
      />
    )

    expect(screen.getByText('All set! Click "Start Analysis" above to begin.')).toBeInTheDocument()
    expect(screen.getAllByText('Done')).toHaveLength(2)
  })

  it('renders the analyzing placeholder before streaming text arrives', () => {
    renderOutputPanel({ analyzing: true, analysisStatus: 'parsing' })

    expect(screen.getByText('Analyzing paper, please wait...')).toBeInTheDocument()
    expect(screen.getByText(/Status: Parsing/)).toBeInTheDocument()
  })

  it('computes token total when providers omit total tokens', () => {
    renderOutputPanel({
      tokenUsage: { promptTokens: 12, completionTokens: 8 },
    })

    expect(screen.getByText(/Tokens:/)).toHaveTextContent('20')
    expect(screen.getByText(/Total tokens:/)).toHaveTextContent('20')
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

  it('renders targeted error suggestions for common failures', () => {
    const { rerender } = renderOutputPanel({ error: 'Unauthorized API key' })
    expect(screen.getByText(/Check your API Key/)).toBeInTheDocument()

    rerender(
      <OutputPanel
        result={null}
        analyzing={false}
        streamingSummary=''
        error='Request timeout while parsing scanned PDF text'
        analysisStatus='error'
        elapsedTime={0}
        tokenUsage={null}
        apiKeyConfigured={true}
        pdfPath='paper.pdf'
        language='en-US'
        onDownloadCode={vi.fn()}
      />
    )
    expect(screen.getByText(/request timed out/)).toBeInTheDocument()
    expect(screen.getByText(/scanned document/)).toBeInTheDocument()

    rerender(
      <OutputPanel
        result={null}
        analyzing={false}
        streamingSummary=''
        error='network ECONNRESET'
        analysisStatus='error'
        elapsedTime={0}
        tokenUsage={null}
        apiKeyConfigured={true}
        pdfPath='paper.pdf'
        language='en-US'
        onDownloadCode={vi.fn()}
      />
    )
    expect(screen.getByText(/internet connection/)).toBeInTheDocument()
  })

  it('falls back to the generic error suggestion and renders markdown tables and links', () => {
    const { rerender } = renderOutputPanel({ error: 'Unexpected model response' })

    expect(screen.getByText(/Please try again/)).toBeInTheDocument()

    rerender(
      <OutputPanel
        result={{
          summary: '# Title\n\n| Model | Score |\n| --- | ---: |\n| A | 1 |\n\n[paper](https://example.com)\n\n```python\nprint("hi")\n```',
          hasCoreCode: false,
        }}
        analyzing={false}
        streamingSummary=''
        error={null}
        analysisStatus='success'
        elapsedTime={0}
        tokenUsage={null}
        apiKeyConfigured={true}
        pdfPath='paper.pdf'
        language='en-US'
        onDownloadCode={vi.fn()}
      />
    )

    expect(screen.getByRole('table')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'paper' })).toHaveAttribute('href', 'https://example.com')
    expect(screen.getByText('print("hi")')).toBeInTheDocument()
  })

  it('renders headings, lists, blockquotes, rules, inline code, emphasis, and normalized math', () => {
    renderOutputPanel({
      result: {
        summary: '# Main\n\n## Sub\n\n### Detail\n\n- first\n- second\n\n1. one\n2. two\n\n> quoted text\n\n---\n\nUse `inlineCode` and *emphasis*.\n\n(plain text).\n\n\\(x_i = y_i\\)\n\n\\[ a_i = b_i \\]\n\n(\\alpha_i = \\beta_i)。',
        hasCoreCode: false,
      },
    })

    expect(screen.getByRole('heading', { level: 2, name: 'Main' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 3, name: 'Sub' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 4, name: 'Detail' })).toBeInTheDocument()
    expect(screen.getByText('first')).toBeInTheDocument()
    expect(screen.getByText('two')).toBeInTheDocument()
    expect(screen.getByText('quoted text')).toBeInTheDocument()
    expect(screen.getByText('inlineCode')).toBeInTheDocument()
    expect(screen.getByText('emphasis')).toBeInTheDocument()
    expect(document.querySelector('.katex')).toBeInTheDocument()
  })
})
