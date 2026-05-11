import { useState } from 'react'
import { FileText, Upload, Play, RefreshCw, LoaderCircle, Square } from 'lucide-react'
import { t, Language } from '../i18n'

interface PDFPanelProps {
  pdfPath: string | null
  analyzing: boolean
  progress: string[]
  apiKeyConfigured: boolean
  hasResult: boolean
  language: Language
  onSelectPDF: () => void
  onSetPDFPath: (path: string) => void
  onAnalyze: () => void
  onCancelAnalyze: () => void
}

const cardStyle: React.CSSProperties = {
  background: 'var(--color-surface)',
  borderRadius: 'var(--radius-md)',
  padding: 18,
  display: 'flex',
  flexDirection: 'column',
  gap: 14,
}

const dropBase: React.CSSProperties = {
  borderRadius: 'var(--radius-sm)',
  padding: '22px 18px',
  textAlign: 'center',
  cursor: 'pointer',
  transition: 'border-color 0.15s, background 0.15s',
  border: '2px dashed var(--color-border)',
  background: 'transparent',
  minHeight: 108,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
}

export default function PDFPanel({ pdfPath, analyzing, progress, apiKeyConfigured, hasResult, language, onSelectPDF, onSetPDFPath, onAnalyze, onCancelAnalyze }: PDFPanelProps) {
  const [dragging, setDragging] = useState(false)

  const fileName = pdfPath
    ? pdfPath.split(/[\\/]/).pop() || pdfPath
    : null

  const shortPath = pdfPath
    ? (() => {
        const parts = pdfPath.split(/[\\/]/)
        return parts.length > 3 ? '...' + parts.slice(-3).join('/') : pdfPath
      })()
    : null

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!analyzing) setDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragging(false)
    if (analyzing) return
    const file = e.dataTransfer.files[0]
    if (file && file.name.toLowerCase().endsWith('.pdf')) {
      const filePath = (file as any).path
      if (filePath) onSetPDFPath(filePath)
    }
  }

  const handleClick = () => {
    if (!analyzing) onSelectPDF()
  }

  const dropStyle: React.CSSProperties = {
    ...dropBase,
    ...(dragging && !analyzing
      ? {
          borderColor: 'var(--color-accent)',
          background: 'var(--color-accent-bg)',
        }
      : {}),
    ...(analyzing ? { cursor: 'not-allowed' } : {}),
  }

  const btnDisabled = !analyzing && (!pdfPath || !apiKeyConfigured)

  const btnText = analyzing
    ? t(language, 'upload.cancelAnalysis')
    : !pdfPath
      ? t(language, 'upload.startAnalysis')
      : !apiKeyConfigured
        ? t(language, 'upload.apiKeyRequired')
        : hasResult
          ? t(language, 'upload.analyzeAgain')
          : t(language, 'upload.startAnalysis')

  return (
    <div style={cardStyle}>
      <div
        onClick={handleClick}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        style={dropStyle}
      >
        {analyzing ? (
          <div style={{ width: '100%', textAlign: 'left' }}>
            {progress.map((step, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '4px 0' }}>
                <LoaderCircle size={14} style={{
                  color: i === progress.length - 1 ? 'var(--color-accent)' : 'var(--color-success)',
                  flexShrink: 0,
                  animation: i === progress.length - 1 ? 'spin 1s linear infinite' : 'none',
                }} />
                <span style={{
                  fontSize: 14,
                  color: i === progress.length - 1 ? 'var(--color-primary)' : 'var(--color-muted)',
                  fontWeight: i === progress.length - 1 ? 500 : 400,
                }}>{step}</span>
              </div>
            ))}
          </div>
        ) : pdfPath ? (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 8 }}>
              <FileText size={18} style={{ color: 'var(--color-accent)', flexShrink: 0 }} />
              <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-primary)' }}>
                {fileName}
              </span>
            </div>
            <div style={{ fontSize: 13, lineHeight: 1.55, color: 'var(--color-muted)', wordBreak: 'break-all' }}>
              {shortPath}
            </div>
            <div style={{ marginTop: 10, display: 'flex', gap: 8, justifyContent: 'center' }}>
              <span style={{
                fontSize: 13, fontWeight: 600, color: 'var(--color-secondary)',
                background: 'var(--color-bg)', border: '1px solid var(--color-border)',
                borderRadius: 5, padding: '2px 8px', lineHeight: '20px',
              }}>
                PDF
              </span>
              {!analyzing && (
                <span style={{
                  fontSize: 13, color: 'var(--color-accent)', cursor: 'pointer', lineHeight: '24px',
                }}
                  onClick={(e) => { e.stopPropagation(); onSelectPDF() }}
                >
                  {t(language, 'upload.changeFile')}
                </span>
              )}
            </div>
          </div>
        ) : dragging ? (
          <div>
            <Upload size={24} style={{ color: 'var(--color-accent)', marginBottom: 6 }} />
            <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--color-accent)' }}>
              {t(language, 'upload.releaseToAttach')}
            </div>
          </div>
        ) : (
          <div>
            <FileText size={24} style={{ color: 'var(--color-muted)', marginBottom: 6 }} />
            <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--color-primary)' }}>
              {t(language, 'upload.dropHere')}
            </div>
            <div style={{ fontSize: 14, lineHeight: 1.55, color: 'var(--color-muted)', marginTop: 4, maxWidth: 340 }}>
              {t(language, 'upload.subtitle')}
            </div>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', alignItems: 'center' }}>
        {!apiKeyConfigured && pdfPath && (
          <span style={{ fontSize: 13, color: 'var(--color-warning)', marginRight: 'auto' }}>
            {t(language, 'upload.setApiKeyHint')}
          </span>
        )}
        <button
          onClick={onSelectPDF}
          disabled={analyzing}
          style={{
            padding: '9px 16px',
            fontSize: 14,
            fontWeight: 500,
            color: 'var(--color-secondary)',
            background: 'transparent',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-sm)',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <FileText size={15} />
          {t(language, 'upload.selectPDF')}
        </button>
        <button
          onClick={analyzing ? onCancelAnalyze : onAnalyze}
          disabled={btnDisabled}
          style={{
            padding: '9px 22px',
            fontSize: 14,
            fontWeight: 600,
            color: '#fff',
            background: analyzing ? 'var(--color-error)' : 'var(--color-accent)',
            borderRadius: 'var(--radius-sm)',
            opacity: btnDisabled ? 0.5 : 1,
            cursor: btnDisabled ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          {analyzing ? (
            <Square size={14} />
          ) : hasResult ? (
            <RefreshCw size={16} />
          ) : (
            <Play size={16} />
          )}
          {btnText}
        </button>
      </div>
    </div>
  )
}
