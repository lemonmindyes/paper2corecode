import { describe, it, expect } from 'vitest'
import { AppError, ErrorCodes } from '../errors'
import {
  extractTaggedContent,
  parseCodeDecision,
  parseTaggedCodeFiles,
  removePartialEndTagSuffix,
  getStreamingSummary,
  normalizeFileContent,
} from '../paperAnalyzer'

// ---------------------------------------------------------------------------
// extractTaggedContent
// ---------------------------------------------------------------------------
describe('extractTaggedContent', () => {
  const START = '<TAG>'
  const END = '</TAG>'
  const ERR = 'missing tag'

  it('extracts content between tags', () => {
    const raw = `prefix ${START}hello world${END} suffix`
    expect(extractTaggedContent(raw, START, END, ERR)).toBe('hello world')
  })

  it('trims whitespace around content', () => {
    const raw = `${START}\n  \ncontent  \n${END}`
    expect(extractTaggedContent(raw, START, END, ERR)).toBe('content')
  })

  it('throws if start tag is missing', () => {
    expect(() => extractTaggedContent('no start', START, END, ERR)).toThrow(AppError)
    expect(() => extractTaggedContent('no start', START, END, ERR)).toThrow(ERR)
  })

  it('throws if end tag is missing', () => {
    const raw = `${START}content only`
    expect(() => extractTaggedContent(raw, START, END, ERR)).toThrow(AppError)
    expect(() => extractTaggedContent(raw, START, END, ERR)).toThrow(ERR)
  })

  it('finds first start tag even when end tag appears before it', () => {
    const raw = `${END}before${START}after${END}`
    expect(extractTaggedContent(raw, START, END, ERR)).toBe('after')
  })

  it('throws for empty content between tags', () => {
    const raw = `${START}${END}`
    expect(() => extractTaggedContent(raw, START, END, ERR)).toThrow(AppError)
  })
})

// ---------------------------------------------------------------------------
// parseCodeDecision
// ---------------------------------------------------------------------------
describe('parseCodeDecision', () => {
  it('parses decision with needed: true', () => {
    const result = parseCodeDecision('{"needed": true}')
    expect(result.needed).toBe(true)
    expect(result.reason).toBeUndefined()
  })

  it('parses decision with needed: false', () => {
    const result = parseCodeDecision('{"needed": false}')
    expect(result.needed).toBe(false)
    expect(result.reason).toBeUndefined()
  })

  it('extracts reason when present', () => {
    const result = parseCodeDecision('{"needed": true, "reason": "has pseudocode"}')
    expect(result.needed).toBe(true)
    expect(result.reason).toBe('has pseudocode')
  })

  it('ignores non-string reason', () => {
    const result = parseCodeDecision('{"needed": false, "reason": 42}')
    expect(result.needed).toBe(false)
    expect(result.reason).toBeUndefined()
  })

  it('strips markdown fences before parsing', () => {
    const raw = '```json\n{"needed": true, "reason": "fenced"}\n```'
    const result = parseCodeDecision(raw)
    expect(result.needed).toBe(true)
    expect(result.reason).toBe('fenced')
  })

  it('throws for non-object JSON', () => {
    expect(() => parseCodeDecision('"string"')).toThrow(AppError)
    expect(() => parseCodeDecision('null')).toThrow(AppError)
    expect(() => parseCodeDecision('42')).toThrow(AppError)
  })

  it('throws if needed field is missing', () => {
    expect(() => parseCodeDecision('{}')).toThrow(AppError)
    expect(() => parseCodeDecision('{"other": true}')).toThrow(AppError)
  })

  it('throws for unparseable input', () => {
    expect(() => parseCodeDecision('not json at all')).toThrow(AppError)
  })

  it('throws for empty input', () => {
    expect(() => parseCodeDecision('')).toThrow(AppError)
  })
})

// ---------------------------------------------------------------------------
// parseTaggedCodeFiles
// ---------------------------------------------------------------------------
describe('parseTaggedCodeFiles', () => {
  it('parses a single file block', () => {
    const raw = `<P2CC_FILE path="core_code/hello.py">print("hello")</P2CC_FILE>`
    const files = parseTaggedCodeFiles(raw)
    expect(files).toHaveLength(1)
    expect(files[0].path).toBe('core_code/hello.py')
    expect(files[0].content).toBe('print("hello")')
  })

  it('parses multiple file blocks', () => {
    const raw = [
      '<P2CC_FILE path="core_code/a.py">aaa</P2CC_FILE>',
      '<P2CC_FILE path="core_code/b.py">bbb</P2CC_FILE>',
    ].join('\n')
    const files = parseTaggedCodeFiles(raw)
    expect(files).toHaveLength(2)
    expect(files[0].path).toBe('core_code/a.py')
    expect(files[1].path).toBe('core_code/b.py')
  })

  it('strips leading/trailing newline from content', () => {
    const raw = '<P2CC_FILE path="core_code/x.py">\ncontent\n</P2CC_FILE>'
    const files = parseTaggedCodeFiles(raw)
    expect(files[0].content).toBe('content')
  })

  it('throws on absolute path', () => {
    const raw = '<P2CC_FILE path="/etc/passwd">bad</P2CC_FILE>'
    expect(() => parseTaggedCodeFiles(raw)).toThrow(AppError)
  })

  it('throws on path with .. traversal', () => {
    const raw = '<P2CC_FILE path="core_code/../../../etc/passwd">bad</P2CC_FILE>'
    expect(() => parseTaggedCodeFiles(raw)).toThrow(AppError)
  })

  it('throws on README.md path', () => {
    const raw = '<P2CC_FILE path="README.md">bad</P2CC_FILE>'
    expect(() => parseTaggedCodeFiles(raw)).toThrow(AppError)
  })

  it('returns empty array for no file blocks', () => {
    const files = parseTaggedCodeFiles('no blocks here')
    expect(files).toHaveLength(0)
  })

  it('handles double-quoted path', () => {
    const raw = '<P2CC_FILE path="core_code/foo.py">x</P2CC_FILE>'
    const files = parseTaggedCodeFiles(raw)
    expect(files).toHaveLength(1)
    expect(files[0].path).toBe('core_code/foo.py')
  })

  it('handles single-quoted path', () => {
    const raw = "<P2CC_FILE path='core_code/bar.py'>x</P2CC_FILE>"
    const files = parseTaggedCodeFiles(raw)
    expect(files).toHaveLength(1)
    expect(files[0].path).toBe('core_code/bar.py')
  })
})

// ---------------------------------------------------------------------------
// removePartialEndTagSuffix
// ---------------------------------------------------------------------------
describe('removePartialEndTagSuffix', () => {
  it('removes partial matching suffix', () => {
    const endTag = '</TAG>'
    expect(removePartialEndTagSuffix('hello</T', endTag)).toBe('hello')
    expect(removePartialEndTagSuffix('hello</TAG', endTag)).toBe('hello')
    expect(removePartialEndTagSuffix('hello</TA', endTag)).toBe('hello')
  })

  it('returns original when no partial match', () => {
    const endTag = '</TAG>'
    expect(removePartialEndTagSuffix('hello world', endTag)).toBe('hello world')
    expect(removePartialEndTagSuffix('</NOT>', endTag)).toBe('</NOT>')
  })

  it('returns original when content is shorter than tag', () => {
    expect(removePartialEndTagSuffix('ab', '</TAG>')).toBe('ab')
  })

  it('handles empty content', () => {
    expect(removePartialEndTagSuffix('', '</TAG>')).toBe('')
  })

  it('only removes the minimum matching suffix', () => {
    // At i=5, '</TAG' matches (5 chars from end)
    // But at i=2, '</' also matches (2 chars from end)
    // The loop goes from max down to 1, so it picks the longest match first
    expect(removePartialEndTagSuffix('content</T', '</TAG>')).toBe('content')
    expect(removePartialEndTagSuffix('content</', '</TAG>')).toBe('content')
  })
})

// ---------------------------------------------------------------------------
// getStreamingSummary
// ---------------------------------------------------------------------------
describe('getStreamingSummary', () => {
  const SUMMARY_START = '<P2CC_SUMMARY>'
  const SUMMARY_END = '</P2CC_SUMMARY>'

  it('extracts complete summary between tags', () => {
    const raw = `${SUMMARY_START}paper content${SUMMARY_END}`
    expect(getStreamingSummary(raw)).toBe('paper content')
  })

  it('returns empty string when start tag is missing', () => {
    expect(getStreamingSummary('no tag here')).toBe('')
  })

  it('strips partial end tag suffix when end tag is incomplete', () => {
    const raw = `${SUMMARY_START}hello world</`
    expect(getStreamingSummary(raw)).toBe('hello world')
  })

  it('returns full content before end tag when end tag is complete', () => {
    const raw = `${SUMMARY_START}hello world${SUMMARY_END}trailing`
    expect(getStreamingSummary(raw)).toBe('hello world')
  })

  it('returns content from start tag to end when end tag is complete', () => {
    const raw = `prefix${SUMMARY_START}the summary${SUMMARY_END}suffix`
    expect(getStreamingSummary(raw)).toBe('the summary')
  })

  it('handles empty summary', () => {
    const raw = `${SUMMARY_START}${SUMMARY_END}`
    expect(getStreamingSummary(raw)).toBe('')
  })
})

// ---------------------------------------------------------------------------
// normalizeFileContent
// ---------------------------------------------------------------------------
describe('normalizeFileContent', () => {
  it('removes leading newline', () => {
    expect(normalizeFileContent('\ncontent')).toBe('content')
    expect(normalizeFileContent('\r\ncontent')).toBe('content')
  })

  it('removes trailing newline', () => {
    expect(normalizeFileContent('content\n')).toBe('content')
    expect(normalizeFileContent('content\r\n')).toBe('content')
  })

  it('removes both leading and trailing newlines', () => {
    expect(normalizeFileContent('\ncontent\n')).toBe('content')
  })

  it('does not change content without leading/trailing newlines', () => {
    expect(normalizeFileContent('content')).toBe('content')
  })

  it('handles empty string', () => {
    expect(normalizeFileContent('')).toBe('')
  })
})
