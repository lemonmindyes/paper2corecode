import * as fs from 'fs'
import * as path from 'path'
import { app } from 'electron'
import { AppError, ErrorCodes } from './errors'

const API_BASE = 'https://api.deepseek.com/v1'

interface DeepSeekConfig {
  apiKey: string
  provider: string
  model: string
}

export function loadConfig(): DeepSeekConfig {
  const cfgPath = path.join(app.getPath('userData'), 'config.json')
  if (!fs.existsSync(cfgPath)) {
    throw new AppError(ErrorCodes.API_KEY_MISSING, 'API Key not configured. Please save your API Key in Settings first.')
  }
  const raw = fs.readFileSync(cfgPath, 'utf-8')
  const config: DeepSeekConfig = {
    provider: 'deepseek',
    model: 'deepseek-v4-flash',
    ...JSON.parse(raw),
  }
  if (!config.apiKey || config.apiKey.trim() === '') {
    throw new AppError(ErrorCodes.API_KEY_MISSING, 'API Key is empty. Please enter a valid API Key in Settings.')
  }
  return config
}

export async function callDeepSeek(
  messages: { role: 'system' | 'user' | 'assistant'; content: string }[],
  onUpdate?: (chunk: string) => void
): Promise<string> {
  const config = loadConfig()

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 120_000)

  try {
    const response = await fetch(`${API_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages,
        stream: true,
      }),
      signal: controller.signal,
    })
    clearTimeout(timeout)

    if (!response.ok) {
      const body = await response.text().catch(() => '')
      switch (response.status) {
        case 401:
          throw new AppError(ErrorCodes.API_UNAUTHORIZED, 'API Key is invalid or expired. Please check your Settings.')
        case 429:
          throw new AppError(ErrorCodes.API_RATE_LIMITED, 'API rate limit exceeded. Please wait and try again.')
        default:
          throw new AppError(
            ErrorCodes.API_SERVER_ERROR,
            `DeepSeek API returned error (${response.status})`,
            body.slice(0, 500)
          )
      }
    }

    const reader = response.body?.getReader()
    if (!reader) {
      throw new AppError(ErrorCodes.API_RESPONSE_INVALID, 'No response stream from API')
    }

    let result = ''
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed || !trimmed.startsWith('data: ')) continue
        const payload = trimmed.slice(6)
        if (payload === '[DONE]') continue

        try {
          const json = JSON.parse(payload)
          const content = json.choices?.[0]?.delta?.content || ''
          if (content) {
            result += content
            onUpdate?.(content)
          }
        } catch {
          // skip malformed JSON chunks
        }
      }
    }

    if (!result.trim()) {
      throw new AppError(ErrorCodes.API_RESPONSE_INVALID, 'API returned empty response')
    }

    return result
  } catch (err) {
    clearTimeout(timeout)
    if (err instanceof AppError) throw err
    if ((err as Error).name === 'AbortError') {
      throw new AppError(ErrorCodes.API_TIMEOUT, 'Request timed out after 120 seconds. The paper may be too long.')
    }
    throw new AppError(
      ErrorCodes.API_NETWORK_ERROR,
      'Network error while connecting to DeepSeek API. Please check your internet connection.',
      (err as Error).message
    )
  }
}
