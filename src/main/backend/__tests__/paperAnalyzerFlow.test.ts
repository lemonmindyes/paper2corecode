import { beforeEach, describe, expect, it, vi } from 'vitest'
import { analyzePaper } from '../paperAnalyzer'
import { ErrorCodes } from '../errors'
import { getCachedCodeBundle } from '../codeCache'
import { callDeepSeek } from '../deepseekClient'
import { parsePDF } from '../pdfParser'
import { getActiveSettings } from '../settingsStore'

vi.mock('../pdfParser', () => ({
  parsePDF: vi.fn(),
}))

vi.mock('../deepseekClient', () => ({
  callDeepSeek: vi.fn(),
}))

vi.mock('../settingsStore', () => ({
  getActiveSettings: vi.fn(),
}))

const mockedParsePDF = vi.mocked(parsePDF)
const mockedCallDeepSeek = vi.mocked(callDeepSeek)
const mockedGetActiveSettings = vi.mocked(getActiveSettings)

const usage = { promptTokens: 100, completionTokens: 20, totalTokens: 120 }
const rawUsage = { prompt_tokens: 100, completion_tokens: 20, total_tokens: 120 }

function outputWithoutCode(summary = 'Paper summary'): string {
  return [
    '<P2CC_SUMMARY>',
    summary,
    '</P2CC_SUMMARY>',
    '<P2CC_CODE_DECISION>{"needed": false}</P2CC_CODE_DECISION>',
  ].join('')
}

function outputWithCode(): string {
  return [
    '<P2CC_SUMMARY>Paper summary</P2CC_SUMMARY>',
    '<P2CC_CODE_DECISION>{"needed": true}</P2CC_CODE_DECISION>',
    '<P2CC_CODE_BLUEPRINT>',
    JSON.stringify({
      coreContribution: 'a minimal loss function',
      minimalImplementationBoundary: 'only the loss function',
      files: [{
        path: 'core_code/loss.py',
        purpose: 'implements the proposed loss function',
        mainSymbols: ['loss'],
        mustInclude: ['loss'],
        mustNotInclude: ['training loop'],
      }],
    }),
    '</P2CC_CODE_BLUEPRINT>',
    '<P2CC_CODE_BUNDLE><P2CC_FILE path="core_code/loss.py">def loss():\n    return 0</P2CC_FILE></P2CC_CODE_BUNDLE>',
  ].join('')
}

function mockLlmOutput(content: string) {
  mockedCallDeepSeek.mockImplementation(async (_messages, onUpdate) => {
    onUpdate?.(content)
    return { content, usage, rawUsage }
  })
}

describe('analyzePaper flow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockedGetActiveSettings.mockReturnValue({
      apiKey: 'key',
      provider: 'deepseek',
      model: 'deepseek-v4-flash',
      language: 'zh-CN',
    })
    mockedParsePDF.mockResolvedValue({ text: 'paper text', pageCount: 3 })
  })

  it('returns the new success shape with usage for summary-only analysis', async () => {
    mockLlmOutput(outputWithoutCode('A compact summary'))
    const progress: string[] = []
    const summaryChunks: string[] = []

    const result = await analyzePaper(
      'paper.pdf',
      (item) => progress.push(item.stage),
      (chunk) => summaryChunks.push(chunk)
    )

    expect(result).toEqual({
      ok: true,
      result: { summary: 'A compact summary', hasCoreCode: false },
      usage,
      rawUsage,
    })
    expect(summaryChunks.join('')).toBe('A compact summary')
    expect(progress).toEqual(expect.arrayContaining(['parsing', 'summarizing', 'generating_code', 'done']))
  })

  it('caches generated core code and returns hasCoreCode for valid code output', async () => {
    mockLlmOutput(outputWithCode())

    const result = await analyzePaper('paper.pdf', () => {})

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.result.hasCoreCode).toBe(true)
    }
    expect(getCachedCodeBundle()?.files).toEqual([
      { path: 'core_code/loss.py', content: 'def loss():\n    return 0' },
    ])
  })

  it('keeps usage when parsing the model output fails after the LLM call', async () => {
    mockLlmOutput('<P2CC_SUMMARY>missing end tag')

    const result = await analyzePaper('paper.pdf', () => {})

    expect(result).toMatchObject({
      ok: false,
      error: { code: ErrorCodes.API_RESPONSE_INVALID },
      usage,
      rawUsage,
    })
  })

  it('returns ANALYSIS_CANCELLED when aborted before parsing starts', async () => {
    const controller = new AbortController()
    controller.abort()

    const result = await analyzePaper('paper.pdf', () => {}, undefined, controller.signal)

    expect(result).toMatchObject({
      ok: false,
      error: { code: ErrorCodes.ANALYSIS_CANCELLED },
    })
    expect(mockedParsePDF).not.toHaveBeenCalled()
  })
})
