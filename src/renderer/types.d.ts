type Language = 'zh-CN' | 'en-US'
type AnalysisStatus = 'idle' | 'parsing' | 'analyzing' | 'success' | 'error'

interface TokenUsage {
  promptTokens?: number
  completionTokens?: number
  totalTokens?: number
}

interface AnalysisResult {
  ok: true
  result: {
    summary: string
    hasCoreCode: boolean
  }
  usage?: TokenUsage
  rawUsage?: unknown
}

interface AnalysisError {
  ok: false
  error: { code: string; message: string; detail?: string }
  usage?: TokenUsage
  rawUsage?: unknown
}

interface ElectronAPI {
  selectPDF: () => Promise<string | null>
  saveSettings: (settings: { apiKey?: string; provider?: string; model?: string; language?: Language }) => Promise<boolean>
  getSettings: () => Promise<{ apiKey: string; provider: string; model: string; language: Language }>
  analyzePaper: (pdfPath: string) => Promise<AnalysisResult | AnalysisError>
  cancelAnalysis: () => Promise<boolean>
  downloadCoreCode: () => Promise<{ ok: true; path: string } | { ok: false; error: string }>
  onAnalysisProgress: (callback: (progress: { stage: string; message: string }) => void) => () => void
  onSummaryChunk: (callback: (chunk: string) => void) => () => void
}

interface Window {
  electronAPI: ElectronAPI
}
