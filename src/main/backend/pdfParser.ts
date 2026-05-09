import * as fs from 'fs'
import * as path from 'path'
import { PDFParse } from 'pdf-parse'
import { AppError, ErrorCodes } from './errors'

export async function parsePDF(filePath: string): Promise<{ text: string; pageCount: number }> {
  if (!filePath) {
    throw new AppError(ErrorCodes.PDF_NOT_FOUND, 'No PDF file path provided')
  }

  if (!fs.existsSync(filePath)) {
    throw new AppError(ErrorCodes.PDF_NOT_FOUND, `File not found: ${filePath}`)
  }

  const ext = path.extname(filePath).toLowerCase()
  if (ext !== '.pdf') {
    throw new AppError(ErrorCodes.PDF_INVALID, 'Selected file is not a PDF', `Expected .pdf, got ${ext}`)
  }

  const buffer = fs.readFileSync(filePath)
  if (buffer.length === 0) {
    throw new AppError(ErrorCodes.PDF_INVALID, 'PDF file is empty')
  }

  let textResult: { text: string; total: number }
  try {
    const parser = new PDFParse({ data: buffer })
    const result = await parser.getText()
    textResult = { text: result.text, total: result.total }
    await parser.destroy().catch(() => {})
  } catch (err) {
    throw new AppError(ErrorCodes.PDF_INVALID, 'Failed to parse PDF', (err as Error).message)
  }

  const text = cleanText(textResult.text)
  if (text.trim().length < 100) {
    throw new AppError(
      ErrorCodes.PDF_TEXT_EMPTY,
      'Could not extract meaningful text from this PDF. It may be a scanned document (OCR not supported).',
      `Extracted text length: ${text.trim().length} chars`
    )
  }

  return { text, pageCount: textResult.total }
}

function cleanText(raw: string): string {
  return raw
    .replace(/\r\n/g, '\n')
    .replace(/\n{4,}/g, '\n\n\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')
    .trim()
}
