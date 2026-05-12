import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AppError, ErrorCodes } from '../errors'
import { parsePDF } from '../pdfParser'

const pdfParseMock = vi.hoisted(() => vi.fn())

vi.mock('pdf-parse', () => ({
  PDFParse: pdfParseMock,
}))

let tempDir: string

function writeFile(name: string, content: string | Buffer) {
  const filePath = path.join(tempDir, name)
  fs.writeFileSync(filePath, content)
  return filePath
}

function expectAppError(error: unknown, code: string) {
  expect(error).toBeInstanceOf(AppError)
  expect((error as AppError).code).toBe(code)
}

describe('parsePDF', () => {
  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'p2cc-pdf-'))
    pdfParseMock.mockReset()
  })

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true })
  })

  it('rejects missing, nonexistent, non-PDF, and empty paths before parsing', async () => {
    await expect(parsePDF('')).rejects.toMatchObject({ code: ErrorCodes.PDF_NOT_FOUND })
    await expect(parsePDF(path.join(tempDir, 'missing.pdf'))).rejects.toMatchObject({ code: ErrorCodes.PDF_NOT_FOUND })

    const textFile = writeFile('paper.txt', 'not a pdf')
    await expect(parsePDF(textFile)).rejects.toMatchObject({ code: ErrorCodes.PDF_INVALID })

    const emptyPdf = writeFile('empty.pdf', Buffer.alloc(0))
    await expect(parsePDF(emptyPdf)).rejects.toMatchObject({ code: ErrorCodes.PDF_INVALID })
    expect(pdfParseMock).not.toHaveBeenCalled()
  })

  it('wraps parser failures as invalid PDF errors', async () => {
    const filePath = writeFile('broken.pdf', 'pdf bytes')
    pdfParseMock.mockImplementation(function () {
      return {
      getText: vi.fn().mockRejectedValue(new Error('bad xref')),
      destroy: vi.fn().mockResolvedValue(undefined),
      }
    })

    await expect(parsePDF(filePath)).rejects.toMatchObject({
      code: ErrorCodes.PDF_INVALID,
      detail: 'bad xref',
    })
  })

  it('rejects PDFs without enough extracted text', async () => {
    const filePath = writeFile('scan.pdf', 'pdf bytes')
    pdfParseMock.mockImplementation(function () {
      return {
      getText: vi.fn().mockResolvedValue({ text: 'too short', total: 1 }),
      destroy: vi.fn().mockResolvedValue(undefined),
      }
    })

    try {
      await parsePDF(filePath)
      throw new Error('Expected parsePDF to reject')
    } catch (error) {
      expectAppError(error, ErrorCodes.PDF_TEXT_EMPTY)
      expect((error as AppError).detail).toContain('Extracted text length')
    }
  })

  it('returns cleaned text and page count for valid PDFs', async () => {
    const filePath = writeFile('paper.pdf', 'pdf bytes')
    const destroy = vi.fn().mockResolvedValue(undefined)
    const rawText = `Title\r\n\r\n\r\n\r\n${'word '.repeat(30)}\x00\x07   end`
    pdfParseMock.mockImplementation(function () {
      return {
      getText: vi.fn().mockResolvedValue({ text: rawText, total: 3 }),
      destroy,
      }
    })

    const result = await parsePDF(filePath)

    expect(result.pageCount).toBe(3)
    expect(result.text).not.toContain('\r')
    expect(result.text).not.toContain('\x00')
    expect(result.text).not.toContain('   ')
    expect(result.text).toContain('Title')
    expect(destroy).toHaveBeenCalledTimes(1)
  })

  it('ignores parser cleanup failures after extracting text', async () => {
    const filePath = writeFile('paper.pdf', 'pdf bytes')
    pdfParseMock.mockImplementation(function () {
      return {
      getText: vi.fn().mockResolvedValue({ text: 'valid '.repeat(30), total: 2 }),
      destroy: vi.fn().mockRejectedValue(new Error('cleanup failed')),
      }
    })

    await expect(parsePDF(filePath)).resolves.toMatchObject({ pageCount: 2 })
  })
})
