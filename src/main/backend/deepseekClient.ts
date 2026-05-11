import { AppError, ErrorCodes } from './errors'
import { getActiveSettings } from './settingsStore'

interface ProviderConfig {
  baseURL: string
}

interface JiekouModelConfig {
  maxTokens?: number
  tokenParam?: 'max_tokens' | 'max_completion_tokens'
  temperature?: number
  unsupportedReason?: string
}

interface GlmModelConfig {
  maxTokens?: number
  temperature?: number
  thinking?: { type: 'enabled' }
}

interface MimoModelConfig {
  maxTokens?: number
  tokenParam?: 'max_tokens' | 'max_completion_tokens'
  temperature?: number
  topP?: number
  frequencyPenalty?: number
  presencePenalty?: number
  stop?: null
}

const PROVIDER_CONFIGS: Record<string, ProviderConfig> = {
  deepseek: { baseURL: 'https://api.deepseek.com/v1' },
  jiekou: { baseURL: 'https://api.jiekou.ai/openai' },
  minimax: { baseURL: 'https://api.minimaxi.com/v1' },
  glm: { baseURL: 'https://open.bigmodel.cn/api/paas/v4' },
  mimo: { baseURL: 'https://api.xiaomimimo.com/v1' },
  kimi: { baseURL: 'https://api.moonshot.cn/v1' },
}

const JIEKOU_MODEL_CONFIGS: Record<string, JiekouModelConfig> = {
  'gemini-3.1-flash-lite-preview': { maxTokens: 65536, tokenParam: 'max_tokens', temperature: 0.7 },
  'gemini-3.1-pro-preview': { maxTokens: 65536, tokenParam: 'max_tokens', temperature: 0.7 },
  'gpt-5.4-nano': {
    unsupportedReason: 'Jiekou API reports this beta model is not usable with the current fixed request parameters.',
  },
  'gpt-5.4-mini': {
    unsupportedReason: 'Jiekou API reports this beta model is not usable with the current fixed request parameters.',
  },
  'gpt-5.4-pro': {
    unsupportedReason: 'Jiekou API reports this model does not support the chat/completions endpoint.',
  },
  'gpt-5.5-pro': {
    unsupportedReason: 'Jiekou API reports this model does not support the chat/completions endpoint.',
  },
}

const GLM_MODEL_CONFIGS: Record<string, GlmModelConfig> = {
  'glm-5.1': { maxTokens: 65536, temperature: 1.0, thinking: { type: 'enabled' } },
  'glm-5': { maxTokens: 65536, temperature: 1.0, thinking: { type: 'enabled' } },
  'glm-5-turbo': { maxTokens: 65536, temperature: 1.0, thinking: { type: 'enabled' } },
}

const MIMO_MODEL_CONFIGS: Record<string, MimoModelConfig> = {
  'mimo-v2.5-pro': {
    maxTokens: 131072,
    tokenParam: 'max_completion_tokens',
    temperature: 1.0,
    topP: 0.95,
    frequencyPenalty: 0,
    presencePenalty: 0,
    stop: null,
  },
  'mimo-v2-pro': {
    maxTokens: 131072,
    tokenParam: 'max_completion_tokens',
    temperature: 1.0,
    topP: 0.95,
    frequencyPenalty: 0,
    presencePenalty: 0,
    stop: null,
  },
  'mimo-v2.5': {
    maxTokens: 32768,
    tokenParam: 'max_completion_tokens',
    temperature: 1.0,
    topP: 0.95,
    frequencyPenalty: 0,
    presencePenalty: 0,
    stop: null,
  },
}

export function loadConfig() {
  const config = getActiveSettings()
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
  const providerCfg = PROVIDER_CONFIGS[config.provider]

  if (!providerCfg) {
    throw new AppError(ErrorCodes.API_SERVER_ERROR, `Unsupported provider: ${config.provider}`)
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 120_000)

  try {
    const modelCfg = config.provider === 'jiekou'
      ? JIEKOU_MODEL_CONFIGS[config.model]
      : config.provider === 'glm'
        ? GLM_MODEL_CONFIGS[config.model]
        : config.provider === 'mimo'
          ? MIMO_MODEL_CONFIGS[config.model]
          : undefined

    if (modelCfg && 'unsupportedReason' in modelCfg && modelCfg.unsupportedReason) {
      throw new AppError(
        ErrorCodes.API_SERVER_ERROR,
        `Model ${config.model} is not supported by the current API endpoint.`,
        modelCfg.unsupportedReason
      )
    }

    const requestBody: {
      model: string
      messages: { role: 'system' | 'user' | 'assistant'; content: string }[]
      stream: boolean
      max_tokens?: number
      max_completion_tokens?: number
      temperature?: number
      top_p?: number
      frequency_penalty?: number
      presence_penalty?: number
      stop?: null
      thinking?: { type: string }
    } = {
      model: config.model,
      messages,
      stream: true,
    }

    if (modelCfg && 'tokenParam' in modelCfg && modelCfg.tokenParam && modelCfg.maxTokens) {
      requestBody[modelCfg.tokenParam] = modelCfg.maxTokens
    } else if (modelCfg?.maxTokens) {
      requestBody.max_tokens = modelCfg.maxTokens
    }

    if (modelCfg && 'temperature' in modelCfg && modelCfg.temperature !== undefined) {
      requestBody.temperature = modelCfg.temperature
    }

    if (modelCfg && 'thinking' in modelCfg && modelCfg.thinking) {
      requestBody.thinking = modelCfg.thinking
    }

    if (modelCfg && 'topP' in modelCfg && modelCfg.topP !== undefined) {
      requestBody.top_p = modelCfg.topP
    }

    if (modelCfg && 'frequencyPenalty' in modelCfg && modelCfg.frequencyPenalty !== undefined) {
      requestBody.frequency_penalty = modelCfg.frequencyPenalty
    }

    if (modelCfg && 'presencePenalty' in modelCfg && modelCfg.presencePenalty !== undefined) {
      requestBody.presence_penalty = modelCfg.presencePenalty
    }

    if (modelCfg && 'stop' in modelCfg && modelCfg.stop === null) {
      requestBody.stop = null
    }

    const response = await fetch(`${providerCfg.baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify(requestBody),
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
            `API returned error (${response.status})`,
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
      'Network error while connecting to API. Please check your internet connection.',
      (err as Error).message
    )
  }
}
