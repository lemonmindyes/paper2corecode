import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AppError, ErrorCodes } from '../errors'
import { callDeepSeek } from '../deepseekClient'
import { getActiveSettings } from '../settingsStore'

vi.mock('../settingsStore', () => ({
  getActiveSettings: vi.fn(),
}))

const mockedGetActiveSettings = vi.mocked(getActiveSettings)

function mockSettings(provider = 'deepseek') {
  mockedGetActiveSettings.mockReturnValue({
    apiKey: 'test-key',
    provider,
    model: provider === 'kimi' ? 'kimi-k2.6' : 'deepseek-v4-flash',
    language: 'zh-CN',
  })
}

function createStreamResponse(chunks: string[], status = 200): Response {
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk))
      }
      controller.close()
    },
  })

  return new Response(stream, { status })
}

describe('callDeepSeek', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    mockSettings()
    vi.stubGlobal('fetch', vi.fn())
  })

  it('streams content and normalizes usage from SSE chunks', async () => {
    const fetchMock = vi.mocked(fetch)
    fetchMock.mockResolvedValue(createStreamResponse([
      'data: {"choices":[{"delta":{"content":"hello "}}]}\n',
      'data: {"choices":[{"delta":{"content":"world"}}],"usage":{"prompt_tokens":10,"completion_tokens":3,"total_tokens":13}}\n',
      'data: [DONE]\n',
    ]))
    const updates: string[] = []

    const result = await callDeepSeek([
      { role: 'user', content: 'Summarize' },
    ], (chunk) => updates.push(chunk))

    expect(result.content).toBe('hello world')
    expect(updates).toEqual(['hello ', 'world'])
    expect(result.usage).toEqual({ promptTokens: 10, completionTokens: 3, totalTokens: 13 })
    expect(result.rawUsage).toEqual({ prompt_tokens: 10, completion_tokens: 3, total_tokens: 13 })
  })

  it('adds include_usage stream option only for compatible providers', async () => {
    const fetchMock = vi.mocked(fetch)
    fetchMock.mockImplementation(async () => createStreamResponse([
      'data: {"choices":[{"delta":{"content":"ok"}}]}\n',
    ]))

    await callDeepSeek([{ role: 'user', content: 'test' }])
    let body = JSON.parse(fetchMock.mock.calls[0][1]?.body as string)
    expect(body.stream_options).toEqual({ include_usage: true })

    fetchMock.mockClear()
    mockSettings('minimax')
    await callDeepSeek([{ role: 'user', content: 'test' }])
    body = JSON.parse(fetchMock.mock.calls[0][1]?.body as string)
    expect(body.stream_options).toBeUndefined()
  })

  it('skips malformed SSE JSON chunks', async () => {
    const fetchMock = vi.mocked(fetch)
    fetchMock.mockResolvedValue(createStreamResponse([
      'data: {bad json}\n',
      'data: {"choices":[{"delta":{"content":"valid"}}]}\n',
    ]))

    await expect(callDeepSeek([{ role: 'user', content: 'test' }])).resolves.toMatchObject({
      content: 'valid',
    })
  })

  it('maps API response errors to app error codes', async () => {
    const fetchMock = vi.mocked(fetch)
    fetchMock.mockResolvedValue(new Response('nope', { status: 429 }))

    await expect(callDeepSeek([{ role: 'user', content: 'test' }])).rejects.toMatchObject({
      code: ErrorCodes.API_RATE_LIMITED,
    })

    fetchMock.mockResolvedValue(new Response('server exploded', { status: 500 }))
    await expect(callDeepSeek([{ role: 'user', content: 'test' }])).rejects.toMatchObject({
      code: ErrorCodes.API_SERVER_ERROR,
      detail: 'server exploded',
    })
  })

  it('throws API_RESPONSE_INVALID for empty streamed content', async () => {
    const fetchMock = vi.mocked(fetch)
    fetchMock.mockResolvedValue(createStreamResponse([
      'data: {"usage":{"prompt_tokens":1,"completion_tokens":0,"total_tokens":1}}\n',
    ]))

    await expect(callDeepSeek([{ role: 'user', content: 'test' }])).rejects.toMatchObject({
      code: ErrorCodes.API_RESPONSE_INVALID,
    })
  })

  it('maps external abort to ANALYSIS_CANCELLED', async () => {
    const controller = new AbortController()
    controller.abort()
    const fetchMock = vi.mocked(fetch)
    fetchMock.mockImplementation(async (_url, init) => {
      if ((init?.signal as AbortSignal).aborted) {
        throw Object.assign(new Error('aborted'), { name: 'AbortError' })
      }
      return createStreamResponse([])
    })

    await expect(callDeepSeek([{ role: 'user', content: 'test' }], undefined, controller.signal))
      .rejects.toBeInstanceOf(AppError)
    await expect(callDeepSeek([{ role: 'user', content: 'test' }], undefined, controller.signal))
      .rejects.toMatchObject({ code: ErrorCodes.ANALYSIS_CANCELLED })
  })
})
