import { describe, expect, it } from 'vitest'
import { normalizeUsage } from '../tokenUsage'

describe('normalizeUsage', () => {
  it('normalizes OpenAI-compatible snake_case usage', () => {
    expect(normalizeUsage({
      prompt_tokens: 100,
      completion_tokens: 25,
      total_tokens: 125,
    })).toEqual({
      promptTokens: 100,
      completionTokens: 25,
      totalTokens: 125,
    })
  })

  it('normalizes input/output token usage fields', () => {
    expect(normalizeUsage({
      input_tokens: 120,
      output_tokens: 30,
    })).toEqual({
      promptTokens: 120,
      completionTokens: 30,
      totalTokens: 150,
    })
  })

  it('normalizes camelCase usage fields', () => {
    expect(normalizeUsage({
      promptTokens: 80,
      completionTokens: 20,
      totalTokens: 100,
    })).toEqual({
      promptTokens: 80,
      completionTokens: 20,
      totalTokens: 100,
    })
  })

  it('calculates total when prompt and completion tokens are present', () => {
    expect(normalizeUsage({
      prompt_tokens: 60,
      completion_tokens: 15,
    })).toEqual({
      promptTokens: 60,
      completionTokens: 15,
      totalTokens: 75,
    })
  })

  it('keeps zero token counts', () => {
    expect(normalizeUsage({
      prompt_tokens: 0,
      completion_tokens: 0,
      total_tokens: 0,
    })).toEqual({
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
    })
  })

  it('returns undefined for missing or invalid usage', () => {
    expect(normalizeUsage(null)).toBeUndefined()
    expect(normalizeUsage('usage')).toBeUndefined()
    expect(normalizeUsage([])).toBeUndefined()
    expect(normalizeUsage({})).toBeUndefined()
    expect(normalizeUsage({ prompt_tokens: '100' })).toBeUndefined()
  })
})
