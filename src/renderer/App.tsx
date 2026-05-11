import { useState, useEffect, useRef } from 'react'
import { Language, t } from './i18n'
import SettingsPanel from './components/SettingsPanel'
import PDFPanel from './components/PDFPanel'
import OutputPanel from './components/OutputPanel'

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
  const cleanupRef = useRef<(() => void) | null>(null)

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

      <div className='app-body'>
        <aside className='sidebar'>
          <SettingsPanel
            language={language}
            onApiKeyConfiguredChange={setApiKeyConfigured}
          />
        </aside>

        <div className='main-content'>
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
