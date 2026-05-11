export interface TokenUsage {
  promptTokens?: number
  completionTokens?: number
  totalTokens?: number
}

function readTokenCount(raw: Record<string, unknown>, keys: string[]): number | undefined {
  for (const key of keys) {
    const value = raw[key]
    if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
      return value
    }
  }

  return undefined
}

export function normalizeUsage(rawUsage: unknown): TokenUsage | undefined {
  if (rawUsage === null || typeof rawUsage !== 'object' || Array.isArray(rawUsage)) {
    return undefined
  }

  const raw = rawUsage as Record<string, unknown>
  const promptTokens = readTokenCount(raw, ['prompt_tokens', 'input_tokens', 'promptTokens', 'inputTokens'])
  const completionTokens = readTokenCount(raw, ['completion_tokens', 'output_tokens', 'completionTokens', 'outputTokens'])
  const providedTotalTokens = readTokenCount(raw, ['total_tokens', 'totalTokens'])
  const totalTokens = providedTotalTokens ?? (
    promptTokens !== undefined && completionTokens !== undefined
      ? promptTokens + completionTokens
      : undefined
  )

  if (promptTokens === undefined && completionTokens === undefined && totalTokens === undefined) {
    return undefined
  }

  return {
    promptTokens,
    completionTokens,
    totalTokens,
  }
}
