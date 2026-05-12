import { describe, expect, it } from 'vitest'
import { Language, t } from '../i18n'

const languages: Language[] = ['zh-CN', 'en-US']
const requiredKeys = [
  'result.status',
  'result.statusIdle',
  'result.statusParsing',
  'result.statusAnalyzing',
  'result.statusSuccess',
  'result.statusError',
  'result.elapsed',
  'result.tokenTotal',
  'result.tokenUnavailable',
  'result.promptTokens',
  'result.completionTokens',
  'result.totalTokens',
  'upload.cancelAnalysis',
]

describe('i18n coverage for analysis metrics', () => {
  it.each(languages)('has all required keys for %s', (language) => {
    for (const key of requiredKeys) {
      expect(t(language, key)).not.toBe(key)
      expect(t(language, key).trim()).not.toBe('')
    }
  })
})
