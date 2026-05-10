import { parsePDF } from './pdfParser'
import { callDeepSeek } from './deepseekClient'
import { buildCombinedAnalysisPrompt } from './promptBuilder'
import { cacheCodeBundle, clearCache, CodeBlueprint, GeneratedFile } from './codeCache'
import { AnalysisProgress, AnalysisResult, AppError, ErrorCodes } from './errors'
import { getActiveSettings } from './settingsStore'
import { BLUEPRINT_START, BLUEPRINT_END, extractJsonObject, parseCodeBlueprint, validateFilesAgainstBlueprint, validateGeneratedFilePath } from './codeBlueprint'

const SUMMARY_START = '<P2CC_SUMMARY>'
const SUMMARY_END = '</P2CC_SUMMARY>'
const DECISION_START = '<P2CC_CODE_DECISION>'
const DECISION_END = '</P2CC_CODE_DECISION>'
const CODE_BUNDLE_START = '<P2CC_CODE_BUNDLE>'
const CODE_BUNDLE_END = '</P2CC_CODE_BUNDLE>'

export function normalizeFileContent(content: string): string {
  return content.replace(/^\r?\n/, '').replace(/\r?\n$/, '')
}

export function parseTaggedCodeFiles(raw: string): GeneratedFile[] {
  const files: GeneratedFile[] = []
  const fileRegex = /<P2CC_FILE\s+path=(['"])(.*?)\1>([\s\S]*?)<\/P2CC_FILE>/g
  let match: RegExpExecArray | null

  while ((match = fileRegex.exec(raw)) !== null) {
    const path = validateGeneratedFilePath(match[2])
    const content = normalizeFileContent(match[3])
    files.push({ path, content })
  }

  return files
}

export function removePartialEndTagSuffix(content: string, endTag: string): string {
  const max = Math.min(endTag.length - 1, content.length)

  for (let i = max; i > 0; i -= 1) {
    if (endTag.startsWith(content.slice(-i))) {
      return content.slice(0, -i)
    }
  }

  return content
}

export function getStreamingSummary(raw: string): string {
  const start = raw.indexOf(SUMMARY_START)
  if (start === -1) return ''

  const contentStart = start + SUMMARY_START.length
  const end = raw.indexOf(SUMMARY_END, contentStart)

  if (end !== -1) {
    return raw.slice(contentStart, end)
  }

  return removePartialEndTagSuffix(raw.slice(contentStart), SUMMARY_END)
}

export function extractTaggedContent(raw: string, startTag: string, endTag: string, errorMessage: string): string {
  const start = raw.indexOf(startTag)
  if (start === -1) {
    throw new AppError(ErrorCodes.API_RESPONSE_INVALID, errorMessage)
  }

  const contentStart = start + startTag.length
  const end = raw.indexOf(endTag, contentStart)
  if (end === -1 || end <= contentStart) {
    throw new AppError(ErrorCodes.API_RESPONSE_INVALID, errorMessage)
  }

  return raw.slice(contentStart, end).trim()
}

export function parseCodeDecision(raw: string): { needed: boolean; reason?: string } {
  const parsed = extractJsonObject(raw)

  if (!parsed || typeof parsed !== 'object' || typeof (parsed as { needed?: unknown }).needed !== 'boolean') {
    throw new AppError(ErrorCodes.API_RESPONSE_INVALID, '模型返回的代码生成决策无效')
  }

  const { needed, reason } = parsed as { needed: boolean; reason?: unknown }
  return {
    needed,
    reason: typeof reason === 'string' ? reason : undefined,
  }
}

export async function analyzePaper(
  pdfPath: string,
  onProgress: (progress: AnalysisProgress) => void,
  onSummaryChunk?: (chunk: string) => void
): Promise<AnalysisResult> {
  let language = 'zh-CN'
  try {
    language = getActiveSettings().language || 'zh-CN'
  } catch {}

  const msg = (zh: string, en: string) => language === 'en-US' ? en : zh

  try {
    clearCache()
    onProgress({ stage: 'parsing', message: msg('读取 PDF 文件...', 'Reading PDF file...') })
    const { text, pageCount } = await parsePDF(pdfPath)
    onProgress({ stage: 'parsing', message: msg(`PDF 解析完成 (${pageCount} 页)`, `PDF parsed (${pageCount} pages)`) })

    onProgress({ stage: 'summarizing', message: msg('正在分析论文结构并生成总结...', 'Analyzing paper structure and generating summary...') })
    const analysisPrompt = buildCombinedAnalysisPrompt(text, language)
    let rawOutput = ''
    let streamedSummary = ''
    let summaryClosed = false
    let decisionProgressSent = false
    let blueprintProgressSent = false
    let bundleProgressSent = false

    await callDeepSeek(
      [
        { role: 'system', content: analysisPrompt.system },
        { role: 'user', content: analysisPrompt.user },
      ],
      (chunk) => {
        rawOutput += chunk

        const currentSummary = getStreamingSummary(rawOutput)
        if (currentSummary.length > streamedSummary.length) {
          const delta = currentSummary.slice(streamedSummary.length)
          streamedSummary = currentSummary
          onSummaryChunk?.(delta)
        }

        if (!summaryClosed && rawOutput.includes(SUMMARY_END)) {
          summaryClosed = true
          onProgress({ stage: 'generating_code', message: msg('总结已完成，正在判断是否需要生成核心代码...', 'Summary complete, deciding whether core code is needed...') })
        }

        if (!decisionProgressSent && rawOutput.includes(DECISION_END)) {
          const decisionContent = extractTaggedContent(rawOutput, DECISION_START, DECISION_END, '模型返回缺少代码生成决策')
          const decision = parseCodeDecision(decisionContent)
          decisionProgressSent = true
          onProgress({
            stage: 'generating_code',
            message: decision.needed
              ? msg('需要生成核心代码，正在准备组件化代码...', 'Core code is needed, preparing componentized code...')
              : msg('模型判断无需生成核心代码', 'Model determined core code is not needed'),
          })
        }

        if (!blueprintProgressSent && rawOutput.includes(BLUEPRINT_END)) {
          blueprintProgressSent = true
          onProgress({ stage: 'generating_code', message: msg('核心代码蓝图已生成，正在生成最小代码文件...', 'Core code blueprint generated, creating minimal files...') })
        }

        if (!bundleProgressSent && rawOutput.includes(CODE_BUNDLE_START)) {
          bundleProgressSent = true
          onProgress({ stage: 'generating_code', message: msg('正在按蓝图生成核心代码文件...', 'Generating core code files from blueprint...') })
        }
      }
    )

    const cleanedSummary = extractTaggedContent(rawOutput, SUMMARY_START, SUMMARY_END, '模型返回缺少论文总结区块')
    const decisionContent = extractTaggedContent(rawOutput, DECISION_START, DECISION_END, '模型返回缺少代码生成决策')
    const decision = parseCodeDecision(decisionContent)

    let hasCoreCode = false

    if (decision.needed) {
      onProgress({ stage: 'generating_code', message: msg('需要生成核心代码，正在校验蓝图和代码范围...', 'Core code is needed, validating blueprint and code scope...') })
      try {
        const blueprintContent = extractTaggedContent(rawOutput, BLUEPRINT_START, BLUEPRINT_END, '模型判断需要生成代码，但缺少核心代码蓝图')
        const blueprint = parseCodeBlueprint(blueprintContent)
        const codeContent = extractTaggedContent(rawOutput, CODE_BUNDLE_START, CODE_BUNDLE_END, '模型判断需要生成代码，但缺少代码文件结构')
        const files = parseTaggedCodeFiles(codeContent)

        validateFilesAgainstBlueprint(files, blueprint)
        cacheCodeBundle({ readme: cleanedSummary.trim(), files, blueprint })
        hasCoreCode = true
        onProgress({ stage: 'generating_code', message: msg('最小核心代码已按蓝图生成', 'Minimal core code has been generated from the blueprint') })
      } catch (err) {
        if (err instanceof AppError && err.code === ErrorCodes.API_RESPONSE_INVALID) {
          onProgress({ stage: 'generating_code', message: msg('模型未能生成有效的核心代码蓝图，本次仅保留论文总结', 'Model did not produce a valid core code blueprint; keeping summary only') })
        } else {
          throw err
        }
      }
    } else {
      onProgress({ stage: 'generating_code', message: msg('模型判断无需生成核心代码', 'Model determined core code is not needed') })
    }

    onProgress({ stage: 'done', message: msg('分析完成', 'Analysis complete') })

    return {
      ok: true,
      summary: cleanedSummary.trim(),
      hasCoreCode,
    }
  } catch (err) {
    if (err instanceof AppError) {
      return {
        ok: false,
        error: { code: err.code, message: err.message, detail: err.detail },
      }
    }
    return {
      ok: false,
      error: { code: ErrorCodes.ANALYSIS_FAILED, message: msg('分析过程中发生未知错误', 'An unknown error occurred during analysis'), detail: (err as Error).message },
    }
  }
}
