import { useEffect, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import 'katex/dist/katex.min.css'
import { FileText, Download, CheckCircle2, AlertCircle, LoaderCircle, FileSearch } from 'lucide-react'
import { t, Language } from '../i18n'

interface OutputPanelProps {
  result: { summary: string; hasCoreCode: boolean } | null
  analyzing: boolean
  streamingSummary: string
  error: string | null
  apiKeyConfigured: boolean
  pdfPath: string | null
  language: Language
  onDownloadCode: () => void
}

export default function OutputPanel({ result, analyzing, streamingSummary, error, apiKeyConfigured, pdfPath, language, onDownloadCode }: OutputPanelProps) {
  const scrollContainerRef = useRef<HTMLDivElement | null>(null)
  const shouldStickToBottomRef = useRef(true)

  useEffect(() => {
    if (analyzing) {
      shouldStickToBottomRef.current = true
    }
  }, [analyzing])

  useEffect(() => {
    if (!analyzing || !streamingSummary.trim() || !shouldStickToBottomRef.current) return

    const scrollContainer = scrollContainerRef.current
    if (!scrollContainer) return

    const frame = window.requestAnimationFrame(() => {
      scrollContainer.scrollTop = scrollContainer.scrollHeight
    })

    return () => window.cancelAnimationFrame(frame)
  }, [analyzing, streamingSummary])

  const handleResultScroll = () => {
    if (!analyzing) return

    const scrollContainer = scrollContainerRef.current
    if (!scrollContainer) return

    const distanceFromBottom = scrollContainer.scrollHeight - scrollContainer.scrollTop - scrollContainer.clientHeight
    shouldStickToBottomRef.current = distanceFromBottom < 120
  }

  return (
    <div style={{
      background: 'var(--color-surface)',
      borderRadius: 'var(--radius-md)',
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      overflow: 'hidden',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        borderBottom: '1px solid var(--color-border)',
        flexShrink: 0,
        padding: '6px 20px 6px 22px',
        gap: 12,
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          color: 'var(--color-primary)',
          fontWeight: 600,
          fontSize: 15,
          letterSpacing: '0.01em',
        }}>
          <FileText size={17} />
          {t(language, 'result.summary')}
        </div>
        {result?.hasCoreCode && (
          <button
            onClick={onDownloadCode}
            style={{
              marginLeft: 'auto',
              padding: '8px 16px',
              background: 'var(--color-accent)',
              color: '#fff',
              fontWeight: 500,
              fontSize: 14,
              borderRadius: 'var(--radius-sm)',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <Download size={16} />
            {t(language, 'result.downloadCode')}
          </button>
        )}
      </div>

      <div
        ref={scrollContainerRef}
        onScroll={handleResultScroll}
        style={{ flex: 1, overflow: 'auto', padding: '30px 36px' }}
      >
        <div style={{ maxWidth: 960, margin: '0 auto', width: '100%' }}>
          {analyzing ? (
            streamingSummary.trim() ? (
              <div>
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                   fontSize: 14, color: 'var(--color-accent)', fontWeight: 500,
                   marginBottom: 18, background: 'var(--color-accent-bg)', padding: '6px 12px',
                   borderRadius: 6,
                 }}>
                  <LoaderCircle size={15} style={{ animation: 'spin 0.8s linear infinite' }} />
                  {t(language, 'result.streamingSummary')}
                </div>
                <MarkdownRenderer content={streamingSummary} />
              </div>
            ) : (
              <div style={{ textAlign: 'center', paddingTop: 48 }}>
                <LoaderCircle size={24} style={{
                  color: 'var(--color-accent)',
                  animation: 'spin 0.8s linear infinite',
                }} />
                <p style={{ color: 'var(--color-muted)', fontSize: 15, marginTop: 14 }}>
                  {t(language, 'result.analyzing')}
                </p>
              </div>
            )
          ) : error ? (
            <ErrorCard language={language} error={error} />
          ) : result ? (
            <div>
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                  fontSize: 14, color: 'var(--color-success)', fontWeight: 500,
                  marginBottom: 18, background: 'var(--color-success-bg)', padding: '6px 12px',
                  borderRadius: 6,
                }}>
                <CheckCircle2 size={15} />
                {t(language, 'result.analysisCompleted')}
              </div>
              <MarkdownRenderer content={result.summary} />
            </div>
          ) : (
            <EmptyState language={language} apiKeyConfigured={apiKeyConfigured} pdfPath={pdfPath} />
          )}
        </div>
      </div>
    </div>
  )
}

function ErrorCard({ language, error }: { language: Language; error: string }) {
  const suggestions: string[] = []
  const lower = error.toLowerCase()
  if (lower.includes('api key') || lower.includes('unauthorized') || lower.includes('apikey')) {
    suggestions.push(t(language, 'error.checkApiKey'))
  }
  if (lower.includes('rate limit') || lower.includes('rate_limit')) {
    suggestions.push(t(language, 'error.rateLimit'))
  }
  if (lower.includes('timeout')) {
    suggestions.push(t(language, 'error.timeout'))
  }
  if ((lower.includes('pdf') && (lower.includes('empty') || lower.includes('text'))) || lower.includes('scanned')) {
    suggestions.push(t(language, 'error.scannedPDF'))
  }
  if (lower.includes('network') || lower.includes('econnrefused') || lower.includes('enotfound') || lower.includes('econnreset')) {
    suggestions.push(t(language, 'error.network'))
  }
  if (suggestions.length === 0) {
    suggestions.push(t(language, 'error.generic'))
  }

  return (
    <div style={{
      padding: 18, background: 'var(--color-error-bg)', borderRadius: 8,
      border: '1px solid var(--color-error-border)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <AlertCircle size={17} style={{ color: 'var(--color-error)' }} />
        <p style={{ fontSize: 16, fontWeight: 600, color: 'var(--color-error)' }}>
          {t(language, 'result.errorTitle')}
        </p>
      </div>
      <p style={{ fontSize: 15, color: 'var(--color-error-text)', lineHeight: 1.7, marginBottom: 14 }}>
        {error}
      </p>
      <div style={{
        fontSize: 15, color: 'var(--color-secondary)', lineHeight: 1.7,
        padding: '10px 14px', background: '#FFF', borderRadius: 6,
      }}>
        <p style={{ fontWeight: 500, marginBottom: 4 }}>{t(language, 'result.suggestedActions')}</p>
        {suggestions.map((s, i) => (
          <p key={i} style={{ paddingLeft: 12, position: 'relative' }}>
            <span style={{ position: 'absolute', left: 2 }}>•</span> {s}
          </p>
        ))}
      </div>
    </div>
  )
}

function EmptyState({ language, apiKeyConfigured, pdfPath }: { language: Language; apiKeyConfigured: boolean; pdfPath: string | null }) {
  const steps = [
    { label: t(language, 'result.step1'), done: apiKeyConfigured },
    { label: t(language, 'result.step2'), done: pdfPath !== null },
    { label: t(language, 'result.step3'), done: false },
  ]

  const allDone = apiKeyConfigured && pdfPath !== null

  return (
    <div style={{ paddingTop: 40 }}>
      <div style={{ textAlign: 'center', marginBottom: 26 }}>
        <FileSearch size={32} style={{ color: 'var(--color-muted)', marginBottom: 10 }} />
        <p style={{ fontSize: 17, fontWeight: 600, color: 'var(--color-primary)', marginBottom: 6 }}>
          {t(language, 'result.readyToAnalyze')}
        </p>
        <p style={{ fontSize: 15, color: 'var(--color-muted)', lineHeight: 1.6 }}>
          {allDone
            ? t(language, 'result.allSet')
            : t(language, 'result.followSteps')}
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {steps.map((step, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '12px 16px',
            background: step.done ? 'var(--color-success-bg)' : 'var(--color-bg)',
            borderRadius: 8,
            border: '1px solid',
            borderColor: step.done ? 'var(--color-success-border)' : 'var(--color-border)',
          }}>
            {step.done ? (
              <CheckCircle2 size={18} style={{ color: 'var(--color-success)', flexShrink: 0 }} />
            ) : (
              <div style={{
                width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                 fontSize: 13, fontWeight: 600,
                background: 'var(--color-border)',
                color: 'var(--color-muted)',
              }}>
                {i + 1}
              </div>
            )}
            <span style={{
               fontSize: 15, fontWeight: step.done ? 500 : 400,
              color: step.done ? 'var(--color-success)' : 'var(--color-primary)',
            }}>
              {step.label}
            </span>
            {step.done && (
               <span style={{ marginLeft: 'auto', fontSize: 14, color: 'var(--color-success)' }}>
                {t(language, 'result.done')}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function normalizeMathMarkdown(content: string): string {
  const normalizedDelimiters = content
    .replace(/\\\[([\s\S]*?)\\\]/g, (_match, math) => `$$\n${math.trim()}\n$$`)
    .replace(/\\\((.*?)\\\)/g, (_match, math) => `$${math.trim()}$`)

  return normalizedDelimiters
    .split('\n')
    .map((line) => {
      const match = line.match(/^(\s*)\((.*)\)([。.,，；;:]?)\s*$/)
      if (!match) return line

      const [, indent, inner, punctuation] = match
      const looksLikeMath = /\\[a-zA-Z]+|[_^]\{|[a-zA-Z]_[a-zA-Z0-9{]/.test(inner) && /[=<>]/.test(inner)
      if (!looksLikeMath) return line

      return `${indent}$$\n${inner.trim()}\n$$${punctuation ? `\n${punctuation}` : ''}`
    })
    .join('\n')
}

function MarkdownRenderer({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkMath]}
      rehypePlugins={[rehypeKatex]}
      components={{
        table: ({ children }) => (
          <div className='markdown-table-frame'>
            <div className='markdown-table-scroll'>
              <table className='markdown-table'>
                {children}
              </table>
            </div>
          </div>
        ),
        thead: ({ children }) => (
          <thead style={{ background: '#F1F5F9' }}>{children}</thead>
        ),
        tbody: ({ children }) => (
          <tbody>{children}</tbody>
        ),
        tr: ({ children }) => (
          <tr>{children}</tr>
        ),
        th: ({ align, children, ...rest }) => {
          const textAlign = align === 'char' ? 'left' : align || 'left'
          return (
            <th className='markdown-table-head' style={{ textAlign }} {...rest}>{children}</th>
          )
        },
        td: ({ align, children, ...rest }) => {
          const textAlign = align === 'char' ? 'left' : align || 'left'
          return (
            <td className='markdown-table-cell' style={{ textAlign }} {...rest}>{children}</td>
          )
        },
        h1: ({ children, ...rest }) => (
          <h2 style={{
            fontSize: 24, fontWeight: 650, margin: '30px 0 14px',
            color: 'var(--color-primary)', lineHeight: 1.3,
            letterSpacing: '-0.01em',
          }} {...rest}>{children}</h2>
        ),
        h2: ({ children, ...rest }) => (
          <h3 style={{
            fontSize: 19, fontWeight: 620, margin: '26px 0 12px',
            color: 'var(--color-primary)', lineHeight: 1.4,
          }} {...rest}>{children}</h3>
        ),
        h3: ({ children, ...rest }) => (
          <h4 style={{
            fontSize: 16, fontWeight: 600, margin: '22px 0 10px',
            color: 'var(--color-primary)', lineHeight: 1.45,
          }} {...rest}>{children}</h4>
        ),
        p: ({ children, ...rest }) => (
          <p style={{
            margin: '8px 0',
            color: 'var(--color-primary)',
            lineHeight: 1.72,
            fontSize: 16,
          }} {...rest}>{children}</p>
        ),
        ul: ({ children, ...rest }) => (
          <ul style={{ paddingLeft: 24, margin: '8px 0', listStyle: 'disc' }} {...rest}>{children}</ul>
        ),
        ol: ({ children, ...rest }) => (
          <ol style={{ paddingLeft: 24, margin: '8px 0', listStyle: 'decimal' }} {...rest}>{children}</ol>
        ),
        li: ({ children, ...rest }) => (
          <li style={{ margin: '5px 0', color: 'var(--color-primary)', lineHeight: 1.72, fontSize: 16 }} {...rest}>{children}</li>
        ),
        code: ({ className, children, ...rest }) => {
          const isBlock = /language-/.test(className || '')
          if (!isBlock) {
            return (
              <code style={{
                background: '#F1F5F9', padding: '1px 5px', borderRadius: 4,
                fontSize: 14, fontFamily: 'var(--font-mono)', color: '#0F172A',
              }} {...rest}>{children}</code>
            )
          }
          return (
            <code style={{
              fontFamily: 'var(--font-mono)', fontSize: 14, lineHeight: 1.65,
              color: '#E2E8F0',
            }} className={className} {...rest}>{children}</code>
          )
        },
        pre: ({ children }) => (
          <div style={{
            background: 'var(--color-code-bg)', border: '1px solid var(--color-code-border)',
            borderRadius: 8, margin: '18px 0', overflow: 'hidden',
          }}>
            <pre style={{
              padding: 18, margin: 0, overflow: 'auto',
              fontFamily: 'var(--font-mono)', fontSize: 14, lineHeight: 1.65,
            }}>
              {children}
            </pre>
          </div>
        ),
        hr: () => (
          <div style={{ borderTop: '1px solid var(--color-border)', margin: '26px 0' }} />
        ),
        blockquote: ({ children, ...rest }) => (
          <blockquote style={{
            borderLeft: '3px solid var(--color-accent)', paddingLeft: 14,
            margin: '16px 0', color: 'var(--color-secondary)', fontSize: 16, lineHeight: 1.72,
          }} {...rest}>{children}</blockquote>
        ),
        a: ({ href, children, ...rest }) => (
          <a href={href}
            style={{ color: 'var(--color-accent)', textDecoration: 'underline' }}
            target='_blank' rel='noopener noreferrer'
            {...rest}>{children}</a>
        ),
        strong: ({ children, ...rest }) => (
          <strong style={{ fontWeight: 600 }} {...rest}>{children}</strong>
        ),
        em: ({ children, ...rest }) => (
          <em style={{ fontStyle: 'italic' }} {...rest}>{children}</em>
        ),
      }}
    >
      {normalizeMathMarkdown(content)}
    </ReactMarkdown>
  )
}
