import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AppError, ErrorCodes } from '../errors'
import { callDeepSeek } from '../deepseekClient'
import { getActiveSettings } from '../settingsStore'

vi.mock('../settingsStore', () => ({
  getActiveSettings: vi.fn(),
}))

const mockedGetActiveSettings = vi.mocked(getActiveSettings)

function mockSettings(provider = 'deepseek', model?: string, apiKey = 'test-key') {
  mockedGetActiveSettings.mockReturnValue({
    apiKey,
    provider,
    model: model ?? (provider === 'kimi' ? 'kimi-k2.6' : 'deepseek-v4-flash'),
    language: 'zh-CN',
    selectedCodeLanguage: 'Python',
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

function createOkStreamResponse(content = 'ok') {
  return createStreamResponse([
    `data: {"choices":[{"delta":{"content":"${content}"}}]}\n`,
  ])
}

function requestBody() {
  return JSON.parse(vi.mocked(fetch).mock.calls.at(-1)?.[1]?.body as string)
}

describe('callDeepSeek', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    mockSettings()
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('throws when the active API key or provider is invalid', async () => {
    const fetchMock = vi.mocked(fetch)

    mockSettings('deepseek', undefined, '   ')
    await expect(callDeepSeek([{ role: 'user', content: 'test' }])).rejects.toMatchObject({
      code: ErrorCodes.API_KEY_MISSING,
    })
    expect(fetchMock).not.toHaveBeenCalled()

    mockSettings('unknown-provider')
    await expect(callDeepSeek([{ role: 'user', content: 'test' }])).rejects.toMatchObject({
      code: ErrorCodes.API_SERVER_ERROR,
      message: 'Unsupported provider: unknown-provider',
    })
    expect(fetchMock).not.toHaveBeenCalled()
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
    fetchMock.mockResolvedValue(new Response('bad key', { status: 401 }))

    await expect(callDeepSeek([{ role: 'user', content: 'test' }])).rejects.toMatchObject({
      code: ErrorCodes.API_UNAUTHORIZED,
    })

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

  it('throws API_RESPONSE_INVALID when the API does not return a stream', async () => {
    const fetchMock = vi.mocked(fetch)
    fetchMock.mockResolvedValue(new Response(null, { status: 200 }))

    await expect(callDeepSeek([{ role: 'user', content: 'test' }])).rejects.toMatchObject({
      code: ErrorCodes.API_RESPONSE_INVALID,
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

  it('maps timeout aborts and network failures to app error codes', async () => {
    vi.useFakeTimers()
    const fetchMock = vi.mocked(fetch)
    fetchMock.mockImplementation(async (_url, init) => new Promise<Response>((_resolve, reject) => {
      ;(init?.signal as AbortSignal).addEventListener('abort', () => {
        reject(Object.assign(new Error('aborted'), { name: 'AbortError' }))
      })
    }))

    const timedOut = expect(callDeepSeek([{ role: 'user', content: 'test' }]))
      .rejects.toMatchObject({ code: ErrorCodes.API_TIMEOUT })
    await vi.advanceTimersByTimeAsync(120_000)
    await timedOut

    vi.useRealTimers()
    fetchMock.mockRejectedValue(new Error('socket closed'))
    await expect(callDeepSeek([{ role: 'user', content: 'test' }])).rejects.toMatchObject({
      code: ErrorCodes.API_NETWORK_ERROR,
      detail: 'socket closed',
    })
  })

  it('applies Jiekou model-specific request options and rejects unsupported models', async () => {
    const fetchMock = vi.mocked(fetch)
    fetchMock.mockImplementation(async () => createOkStreamResponse())
    mockSettings('jiekou', 'gemini-3.1-flash-lite-preview')

    await callDeepSeek([{ role: 'user', content: 'test' }])
    expect(requestBody()).toMatchObject({
      model: 'gemini-3.1-flash-lite-preview',
      max_tokens: 65536,
      temperature: 0.7,
    })

    mockSettings('jiekou', 'gpt-5.5-pro')
    await expect(callDeepSeek([{ role: 'user', content: 'test' }])).rejects.toMatchObject({
      code: ErrorCodes.API_SERVER_ERROR,
      message: 'Model gpt-5.5-pro is not supported by the current API endpoint.',
    })
  })

  it('applies GLM and MiMo model-specific request options', async () => {
    const fetchMock = vi.mocked(fetch)
    fetchMock.mockImplementation(async () => createOkStreamResponse())

    mockSettings('glm', 'glm-5.1')
    await callDeepSeek([{ role: 'user', content: 'test' }])
    expect(requestBody()).toMatchObject({
      model: 'glm-5.1',
      max_tokens: 65536,
      temperature: 1,
      thinking: { type: 'enabled' },
    })

    mockSettings('mimo', 'mimo-v2.5-pro')
    await callDeepSeek([{ role: 'user', content: 'test' }])
    expect(requestBody()).toMatchObject({
      model: 'mimo-v2.5-pro',
      max_completion_tokens: 131072,
      temperature: 1,
      top_p: 0.95,
      frequency_penalty: 0,
      presence_penalty: 0,
      stop: null,
    })
  })
})
