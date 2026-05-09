type Language = 'zh-CN' | 'en-US'

interface AnalysisResult {
  ok: true
  summary: string
  hasCoreCode: boolean
}

interface AnalysisError {
  ok: false
  error: { code: string; message: string; detail?: string }
}

interface ElectronAPI {
  selectPDF: () => Promise<string | null>
  saveSettings: (settings: { apiKey: string; provider: string; model: string; language: Language }) => Promise<boolean>
  getSettings: () => Promise<{ apiKey: string; provider: string; model: string; language: Language }>
  analyzePaper: (pdfPath: string) => Promise<AnalysisResult | AnalysisError>
  downloadCoreCode: () => Promise<{ ok: true; path: string } | { ok: false; error: string }>
  onAnalysisProgress: (callback: (progress: { stage: string; message: string }) => void) => () => void
  onSummaryChunk: (callback: (chunk: string) => void) => () => void
}

interface Window {
  electronAPI: ElectronAPI
}
