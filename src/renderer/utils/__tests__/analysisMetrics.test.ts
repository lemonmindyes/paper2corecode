import { describe, expect, it } from 'vitest'
import { formatElapsedTime, formatTokenCount, getTokenTotal } from '../analysisMetrics'

describe('analysis metrics helpers', () => {
  it('formats elapsed seconds as mm:ss before one hour', () => {
    expect(formatElapsedTime(0)).toBe('00:00')
    expect(formatElapsedTime(85)).toBe('01:25')
    expect(formatElapsedTime(728)).toBe('12:08')
  })

  it('formats elapsed seconds as hh:mm:ss after one hour', () => {
    expect(formatElapsedTime(4350)).toBe('01:12:30')
  })

  it('clamps negative elapsed time to zero', () => {
    expect(formatElapsedTime(-10)).toBe('00:00')
  })

  it('uses provided total tokens first', () => {
    expect(getTokenTotal({ promptTokens: 10, completionTokens: 5, totalTokens: 20 })).toBe(20)
  })

  it('calculates total tokens from prompt and completion counts', () => {
    expect(getTokenTotal({ promptTokens: 10, completionTokens: 5 })).toBe(15)
  })

  it('returns undefined when token total is unavailable', () => {
    expect(getTokenTotal(null)).toBeUndefined()
    expect(getTokenTotal({ promptTokens: 10 })).toBeUndefined()
  })

  it('formats missing token counts as a placeholder', () => {
    expect(formatTokenCount(undefined)).toBe('-')
    expect(formatTokenCount(1234)).toBe((1234).toLocaleString())
  })
})
