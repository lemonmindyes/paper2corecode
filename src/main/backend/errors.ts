import { TokenUsage } from './tokenUsage'

export const ErrorCodes = {
  PDF_NOT_FOUND: 'PDF_NOT_FOUND',
  PDF_INVALID: 'PDF_INVALID',
  PDF_TEXT_EMPTY: 'PDF_TEXT_EMPTY',
  API_KEY_MISSING: 'API_KEY_MISSING',
  API_UNAUTHORIZED: 'API_UNAUTHORIZED',
  API_RATE_LIMITED: 'API_RATE_LIMITED',
  API_SERVER_ERROR: 'API_SERVER_ERROR',
  API_TIMEOUT: 'API_TIMEOUT',
  API_NETWORK_ERROR: 'API_NETWORK_ERROR',
  API_RESPONSE_INVALID: 'API_RESPONSE_INVALID',
  ANALYSIS_FAILED: 'ANALYSIS_FAILED',
  ANALYSIS_CANCELLED: 'ANALYSIS_CANCELLED',
  NO_CODE_CACHE: 'NO_CODE_CACHE',
  EXPORT_FAILED: 'EXPORT_FAILED',
} as const

export class AppError extends Error {
  constructor(
    public code: string,
    message: string,
    public detail?: string
  ) {
    super(message)
    this.name = 'AppError'
  }
}

export type AnalysisProgress =
  | { stage: 'parsing'; message: string }
  | { stage: 'summarizing'; message: string }
  | { stage: 'generating_code'; message: string }
  | { stage: 'done'; message: string }

export type AnalysisResult =
  | {
      ok: true
      result: {
        summary: string
        hasCoreCode: boolean
      }
      usage?: TokenUsage
      rawUsage?: unknown
    }
  | {
      ok: false
      error: { code: string; message: string; detail?: string }
      usage?: TokenUsage
      rawUsage?: unknown
    }

export type ExportResult =
  | { ok: true; path: string }
  | { ok: false; error: string }
