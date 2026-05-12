import { useState, useEffect, useRef } from 'react'
import { Language, t } from './i18n'
import SettingsPanel from './components/SettingsPanel'
import PDFPanel from './components/PDFPanel'
import OutputPanel from './components/OutputPanel'
import { clamp, readStoredNumber } from './utils/resizableLayout'

const SIDEBAR_WIDTH_KEY = 'paper2corecode.sidebarWidth'
const UPLOAD_HEIGHT_KEY = 'paper2corecode.uploadHeight'
const SIDEBAR_DEFAULT_WIDTH = 280
const SIDEBAR_MIN_WIDTH = 220
const SIDEBAR_MAX_WIDTH = 420
const MAIN_MIN_WIDTH = 520
const UPLOAD_DEFAULT_HEIGHT = 260
const UPLOAD_MIN_HEIGHT = 230
const UPLOAD_MAX_HEIGHT = 420
const RESULT_MIN_HEIGHT = 260
const RESIZE_HANDLE_SIZE = 16

function getContentWidth(element: HTMLElement): number {
  const styles = window.getComputedStyle(element)
  return element.clientWidth - parseFloat(styles.paddingLeft) - parseFloat(styles.paddingRight)
}

export default function App() {
  const [pdfPath, setPdfPath] = useState<string | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [progress, setProgress] = useState<{ stage: string; message: string }[]>([])
  const [result, setResult] = useState<{ summary: string; hasCoreCode: boolean } | null>(null)
  const [streamingSummary, setStreamingSummary] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [analysisStatus, setAnalysisStatus] = useState<AnalysisStatus>('idle')
  const [elapsedTime, setElapsedTime] = useState(0)
  const [startedAt, setStartedAt] = useState<number | null>(null)
  const [finishedAt, setFinishedAt] = useState<number | null>(null)
  const [tokenUsage, setTokenUsage] = useState<TokenUsage | null>(null)
  const [apiKeyConfigured, setApiKeyConfigured] = useState(false)
  const [language, setLanguage] = useState<Language>('zh-CN')
  const [showCompletionDialog, setShowCompletionDialog] = useState(false)
  const [sidebarWidth, setSidebarWidth] = useState(() => clamp(
    readStoredNumber(SIDEBAR_WIDTH_KEY, SIDEBAR_DEFAULT_WIDTH),
    SIDEBAR_MIN_WIDTH,
    SIDEBAR_MAX_WIDTH
  ))
  const [uploadHeight, setUploadHeight] = useState(() => clamp(
    readStoredNumber(UPLOAD_HEIGHT_KEY, UPLOAD_DEFAULT_HEIGHT),
    UPLOAD_MIN_HEIGHT,
    UPLOAD_MAX_HEIGHT
  ))
  const cleanupRef = useRef<(() => void) | null>(null)
  const appBodyRef = useRef<HTMLDivElement | null>(null)
  const mainContentRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    window.electronAPI.getSettings().then((s) => {
      setApiKeyConfigured(s.apiKey.trim().length > 0)
      if (s.language) setLanguage(s.language)
    })
    return () => cleanupRef.current?.()
  }, [])

  useEffect(() => {
    if (startedAt === null || finishedAt !== null) return

    const updateElapsed = () => {
      setElapsedTime(Math.floor((Date.now() - startedAt) / 1000))
    }

    updateElapsed()
    const timer = window.setInterval(updateElapsed, 1000)

    return () => window.clearInterval(timer)
  }, [startedAt, finishedAt])

  useEffect(() => {
    const clampLayoutToViewport = () => {
      const appBody = appBodyRef.current
      if (appBody) {
        const maxSidebarWidth = Math.max(
          SIDEBAR_MIN_WIDTH,
          Math.min(SIDEBAR_MAX_WIDTH, getContentWidth(appBody) - RESIZE_HANDLE_SIZE - MAIN_MIN_WIDTH)
        )
        setSidebarWidth((width) => clamp(width, SIDEBAR_MIN_WIDTH, maxSidebarWidth))
      }

      const mainContent = mainContentRef.current
      if (mainContent) {
        const maxUploadHeight = Math.max(
          UPLOAD_MIN_HEIGHT,
          Math.min(UPLOAD_MAX_HEIGHT, mainContent.clientHeight - RESIZE_HANDLE_SIZE - RESULT_MIN_HEIGHT)
        )
        setUploadHeight((height) => clamp(height, UPLOAD_MIN_HEIGHT, maxUploadHeight))
      }
    }

    clampLayoutToViewport()
    window.addEventListener('resize', clampLayoutToViewport)

    return () => window.removeEventListener('resize', clampLayoutToViewport)
  }, [])

  const resetAnalysisMeta = () => {
    setAnalysisStatus('idle')
    setElapsedTime(0)
    setStartedAt(null)
    setFinishedAt(null)
    setTokenUsage(null)
  }

  const handleSelectPDF = async () => {
    const path = await window.electronAPI.selectPDF()
    if (path) {
      setPdfPath(path)
      setResult(null)
      setStreamingSummary('')
      setError(null)
      resetAnalysisMeta()
      setShowCompletionDialog(false)
    }
  }

  const handleSetPDFPath = (path: string) => {
    setPdfPath(path)
    setResult(null)
    setStreamingSummary('')
    setError(null)
    resetAnalysisMeta()
    setShowCompletionDialog(false)
  }

  const handleAnalyze = async () => {
    if (!pdfPath) return
    const started = Date.now()

    setAnalyzing(true)
    setProgress([])
    setResult(null)
    setStreamingSummary('')
    setError(null)
    setAnalysisStatus('parsing')
    setElapsedTime(0)
    setStartedAt(started)
    setFinishedAt(null)
    setTokenUsage(null)
    setShowCompletionDialog(false)

    let removeListener: (() => void) | null = window.electronAPI.onAnalysisProgress((p) => {
      if (p.stage === 'parsing') {
        setAnalysisStatus('parsing')
      } else if (p.stage === 'summarizing' || p.stage === 'generating_code') {
        setAnalysisStatus('analyzing')
      }

      setProgress((prev) => {
        const exists = prev.some((x) => x.stage === p.stage && x.message === p.message)
        return exists ? prev : [...prev, p]
      })
    })
    let removeSummaryListener: (() => void) | null = window.electronAPI.onSummaryChunk((chunk) => {
      setStreamingSummary((prev) => prev + chunk)
    })
    cleanupRef.current = () => {
      removeListener?.()
      removeSummaryListener?.()
    }

    try {
      const res = await window.electronAPI.analyzePaper(pdfPath)
      const ended = Date.now()
      setFinishedAt(ended)
      setElapsedTime(Math.floor((ended - started) / 1000))
      setAnalyzing(false)

      if (res.ok) {
        setAnalysisStatus('success')
        setResult(res.result)
        setStreamingSummary(res.result.summary)
        setTokenUsage(res.usage ?? null)
        setShowCompletionDialog(true)
      } else {
        setAnalysisStatus('error')
        setTokenUsage(res.usage ?? null)
        const detail = res.error.detail?.trim()
        setError(detail ? `${res.error.message}\n\n${detail}` : res.error.message)
      }
    } catch (err) {
      const ended = Date.now()
      setFinishedAt(ended)
      setElapsedTime(Math.floor((ended - started) / 1000))
      setAnalyzing(false)
      setAnalysisStatus('error')
      setError((err as Error).message)
    } finally {
      removeListener?.()
      removeSummaryListener?.()
      removeListener = null
      removeSummaryListener = null
      cleanupRef.current = null
    }
  }

  const handleDownloadCode = async () => {
    const res = await window.electronAPI.downloadCoreCode()
    if (!res.ok) {
      setError(res.error)
    }
  }

  const handleCancelAnalyze = async () => {
    await window.electronAPI.cancelAnalysis()
  }

  const handleLanguageChange = async (lang: Language) => {
    setLanguage(lang)
    await window.electronAPI.saveSettings({ language: lang })
  }

  const handleSidebarResizeStart = (event: React.PointerEvent<HTMLDivElement>) => {
    const appBody = appBodyRef.current
    if (!appBody) return

    event.preventDefault()
    const startX = event.clientX
    const startWidth = sidebarWidth
    const maxSidebarWidth = Math.max(
      SIDEBAR_MIN_WIDTH,
      Math.min(SIDEBAR_MAX_WIDTH, getContentWidth(appBody) - RESIZE_HANDLE_SIZE - MAIN_MIN_WIDTH)
    )

    document.body.classList.add('is-resizing-layout', 'is-resizing-column')

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const nextWidth = clamp(startWidth + moveEvent.clientX - startX, SIDEBAR_MIN_WIDTH, maxSidebarWidth)
      setSidebarWidth(nextWidth)
    }

    const handlePointerUp = (upEvent: PointerEvent) => {
      const nextWidth = clamp(startWidth + upEvent.clientX - startX, SIDEBAR_MIN_WIDTH, maxSidebarWidth)
      setSidebarWidth(nextWidth)
      try {
        window.localStorage.setItem(SIDEBAR_WIDTH_KEY, String(Math.round(nextWidth)))
      } catch {}
      document.body.classList.remove('is-resizing-layout', 'is-resizing-column')
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
      window.removeEventListener('pointercancel', handlePointerUp)
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
    window.addEventListener('pointercancel', handlePointerUp)
  }

  const handleUploadResizeStart = (event: React.PointerEvent<HTMLDivElement>) => {
    const mainContent = mainContentRef.current
    if (!mainContent) return

    event.preventDefault()
    const startY = event.clientY
    const startHeight = uploadHeight
    const maxUploadHeight = Math.max(
      UPLOAD_MIN_HEIGHT,
      Math.min(UPLOAD_MAX_HEIGHT, mainContent.clientHeight - RESIZE_HANDLE_SIZE - RESULT_MIN_HEIGHT)
    )

    document.body.classList.add('is-resizing-layout', 'is-resizing-row')

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const nextHeight = clamp(startHeight + moveEvent.clientY - startY, UPLOAD_MIN_HEIGHT, maxUploadHeight)
      setUploadHeight(nextHeight)
    }

    const handlePointerUp = (upEvent: PointerEvent) => {
      const nextHeight = clamp(startHeight + upEvent.clientY - startY, UPLOAD_MIN_HEIGHT, maxUploadHeight)
      setUploadHeight(nextHeight)
      try {
        window.localStorage.setItem(UPLOAD_HEIGHT_KEY, String(Math.round(nextHeight)))
      } catch {}
      document.body.classList.remove('is-resizing-layout', 'is-resizing-row')
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
      window.removeEventListener('pointercancel', handlePointerUp)
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
    window.addEventListener('pointercancel', handlePointerUp)
  }

  const progressMessages = progress.map((p) => p.message)

  return (
    <div className='app-shell'>
      <header className='app-bar'>
        <div className='app-bar-left'>
          <span className='app-logo'>Paper2CoreCode</span>
        </div>
        <div className='app-bar-right'>
          <div style={{
            display: 'flex', gap: 2, padding: 2,
            background: 'var(--color-bg)',
            borderRadius: 7, marginRight: 8,
          }}>
            <button
              onClick={() => handleLanguageChange('zh-CN')}
              style={{
                padding: '3px 10px', fontSize: 13, lineHeight: '22px',
                fontWeight: language === 'zh-CN' ? 600 : 400,
                color: language === 'zh-CN' ? '#fff' : 'var(--color-muted)',
                background: language === 'zh-CN' ? 'var(--color-accent)' : 'transparent',
                borderRadius: 5,
              }}
            >中文</button>
            <button
              onClick={() => handleLanguageChange('en-US')}
              style={{
                padding: '3px 10px', fontSize: 13, lineHeight: '22px',
                fontWeight: language === 'en-US' ? 600 : 400,
                color: language === 'en-US' ? '#fff' : 'var(--color-muted)',
                background: language === 'en-US' ? 'var(--color-accent)' : 'transparent',
                borderRadius: 5,
              }}
            >EN</button>
          </div>
        </div>
      </header>

      <div
        ref={appBodyRef}
        className='app-body'
        style={{ gridTemplateColumns: `${sidebarWidth}px ${RESIZE_HANDLE_SIZE}px minmax(0, 1fr)` }}
      >
        <aside className='sidebar'>
          <SettingsPanel
            language={language}
            onApiKeyConfiguredChange={setApiKeyConfigured}
          />
        </aside>

        <div
          className='resize-handle resize-handle-vertical'
          role='separator'
          aria-orientation='vertical'
          aria-label='Resize sidebar'
          onPointerDown={handleSidebarResizeStart}
        />

        <div
          ref={mainContentRef}
          className='main-content'
          style={{ gridTemplateRows: `${uploadHeight}px ${RESIZE_HANDLE_SIZE}px minmax(0, 1fr)` }}
        >
          <div className='workspace'>
            <PDFPanel
              pdfPath={pdfPath}
              analyzing={analyzing}
              progress={progressMessages}
              apiKeyConfigured={apiKeyConfigured}
              hasResult={result !== null || error !== null}
              language={language}
              onSelectPDF={handleSelectPDF}
              onSetPDFPath={handleSetPDFPath}
              onAnalyze={handleAnalyze}
              onCancelAnalyze={handleCancelAnalyze}
            />
          </div>

          <div
            className='resize-handle resize-handle-horizontal'
            role='separator'
            aria-orientation='horizontal'
            aria-label='Resize upload and summary panels'
            onPointerDown={handleUploadResizeStart}
          />

          <div className='result-viewer'>
            <OutputPanel
              result={result}
              analyzing={analyzing}
              streamingSummary={streamingSummary}
              error={error}
              analysisStatus={analysisStatus}
              elapsedTime={elapsedTime}
              tokenUsage={tokenUsage}
              apiKeyConfigured={apiKeyConfigured}
              pdfPath={pdfPath}
              language={language}
              onDownloadCode={handleDownloadCode}
            />
          </div>
        </div>
      </div>

      {showCompletionDialog && result && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.32)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50,
        }}>
          <div style={{
            width: 360, background: 'var(--color-surface)', borderRadius: 12,
            boxShadow: '0 24px 60px rgba(15, 23, 42, 0.22)', padding: 20,
            border: '1px solid var(--color-border)',
          }}>
            <p style={{ fontSize: 16, fontWeight: 650, color: 'var(--color-primary)', marginBottom: 8 }}>
              {t(language, 'result.completionTitle')}
            </p>
            <p style={{ fontSize: 15, lineHeight: 1.7, color: 'var(--color-secondary)', marginBottom: 18 }}>
              {result.hasCoreCode
                ? t(language, 'result.completionWithCode')
                : t(language, 'result.completionSummaryOnly')}
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowCompletionDialog(false)}
                style={{
                  background: 'var(--color-accent)', color: '#fff', fontSize: 14,
                  fontWeight: 600, padding: '8px 14px', borderRadius: 8,
                }}
              >
                {t(language, 'result.close')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
