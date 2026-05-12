// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest'
import { clamp, readStoredNumber } from '../resizableLayout'

describe('resizable layout helpers', () => {
  it('clamps values between min and max', () => {
    expect(clamp(100, 220, 420)).toBe(220)
    expect(clamp(300, 220, 420)).toBe(300)
    expect(clamp(500, 220, 420)).toBe(420)
  })

  it('falls back to min when max is below min', () => {
    expect(clamp(300, 220, 100)).toBe(220)
  })

  it('reads finite stored numbers', () => {
    const storage = { getItem: vi.fn().mockReturnValue('320') }
    expect(readStoredNumber('width', 280, storage)).toBe(320)
  })

  it('returns fallback for missing or invalid stored values', () => {
    expect(readStoredNumber('width', 280, { getItem: vi.fn().mockReturnValue(null) })).toBe(280)
    expect(readStoredNumber('width', 280, { getItem: vi.fn().mockReturnValue('wide') })).toBe(280)
  })

  it('returns fallback when storage access throws', () => {
    const storage = { getItem: vi.fn(() => { throw new Error('blocked') }) }
    expect(readStoredNumber('width', 280, storage)).toBe(280)
  })
})
