import { parsePDF } from './pdfParser'
import { callDeepSeek } from './deepseekClient'
import { buildCombinedAnalysisPrompt } from './promptBuilder'
import { cacheCodeBundle, clearCache, CodeBlueprint, CodeBlueprintFile, GeneratedFile } from './codeCache'
import { AnalysisProgress, AnalysisResult, AppError, ErrorCodes } from './errors'
import { getActiveSettings } from './settingsStore'

const SUMMARY_START = '<P2CC_SUMMARY>'
const SUMMARY_END = '</P2CC_SUMMARY>'
const DECISION_START = '<P2CC_CODE_DECISION>'
const DECISION_END = '</P2CC_CODE_DECISION>'
const BLUEPRINT_START = '<P2CC_CODE_BLUEPRINT>'
const BLUEPRINT_END = '</P2CC_CODE_BLUEPRINT>'
const CODE_BUNDLE_START = '<P2CC_CODE_BUNDLE>'
const CODE_BUNDLE_END = '</P2CC_CODE_BUNDLE>'

const HIGH_RISK_FILE_NAMES = new Set([
  'baseline.py',
  'config.py',
  'dataset.py',
  'dataloader.py',
  'experiment.py',
  'experiment_runner.py',
  'inference.py',
  'main.py',
  'pipeline.py',
  'requirements.txt',
  'train.py',
  'utils.py',
])

const HIGH_RISK_JUSTIFICATION_TERMS = [
  'proposed',
  'novel',
  'core contribution',
  'method itself',
  'algorithm',
  'procedure',
  '本文提出',
  '提出的',
  '核心贡献',
  '方法本身',
]

function extractJsonObject(raw: string): unknown {
  const trimmed = raw.trim()
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/)
  const candidate = fenced ? fenced[1].trim() : trimmed
  const start = candidate.indexOf('{')
  const end = candidate.lastIndexOf('}')

  if (start === -1 || end === -1 || end <= start) {
    throw new AppError(ErrorCodes.API_RESPONSE_INVALID, '模型返回的 JSON 结构无效')
  }

  try {
    return JSON.parse(candidate.slice(start, end + 1))
  } catch (err) {
    throw new AppError(ErrorCodes.API_RESPONSE_INVALID, '模型返回的 JSON 不是可解析格式', (err as Error).message)
  }
}

function validateGeneratedFilePath(filePath: string): string {
  const normalizedPath = filePath.trim().replace(/\\/g, '/')
  const lowerPath = normalizedPath.toLowerCase()
  const parts = normalizedPath.split('/')

  if (
    normalizedPath.startsWith('/') ||
    /^[a-z]:/i.test(normalizedPath) ||
    parts.includes('..') ||
    parts.includes('') ||
    lowerPath === 'readme.md' ||
    lowerPath.endsWith('/readme.md')
  ) {
    throw new AppError(ErrorCodes.API_RESPONSE_INVALID, `模型返回了非法文件路径: ${filePath}`)
  }

  return normalizedPath
}

function normalizeFileContent(content: string): string {
  return content.replace(/^\r?\n/, '').replace(/\r?\n$/, '')
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function requireNonEmptyString(value: unknown, fieldName: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new AppError(ErrorCodes.API_RESPONSE_INVALID, `模型返回的代码蓝图缺少 ${fieldName}`)
  }

  return value.trim()
}

function requireStringArray(value: unknown, fieldName: string): string[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new AppError(ErrorCodes.API_RESPONSE_INVALID, `模型返回的代码蓝图缺少 ${fieldName}`)
  }

  const strings = value.map((item) => requireNonEmptyString(item, fieldName))
  return strings
}

function optionalStringArray(value: unknown, fieldName: string): string[] | undefined {
  if (value === undefined) return undefined
  if (!Array.isArray(value)) {
    throw new AppError(ErrorCodes.API_RESPONSE_INVALID, `模型返回的代码蓝图 ${fieldName} 格式无效`)
  }

  return value.map((item) => requireNonEmptyString(item, fieldName))
}

function requiresHighRiskJustification(file: CodeBlueprintFile): boolean {
  const fileName = file.path.split('/').pop()?.toLowerCase() || ''
  if (!HIGH_RISK_FILE_NAMES.has(fileName)) return false

  const justification = [file.purpose, file.evidence, ...file.mustInclude].join(' ').toLowerCase()
  return !HIGH_RISK_JUSTIFICATION_TERMS.some((term) => justification.includes(term))
}

function parseCodeBlueprint(raw: string): CodeBlueprint {
  const parsed = extractJsonObject(raw)
  if (!isRecord(parsed)) {
    throw new AppError(ErrorCodes.API_RESPONSE_INVALID, '模型返回的代码蓝图无效')
  }

  const rawFiles = parsed.files
  if (!Array.isArray(rawFiles) || rawFiles.length === 0) {
    throw new AppError(ErrorCodes.API_RESPONSE_INVALID, '模型返回的代码蓝图缺少文件规划')
  }

  const paths = new Set<string>()
  const files = rawFiles.map((rawFile, index): CodeBlueprintFile => {
    if (!isRecord(rawFile)) {
      throw new AppError(ErrorCodes.API_RESPONSE_INVALID, `模型返回的代码蓝图文件 #${index + 1} 无效`)
    }

    const path = validateGeneratedFilePath(requireNonEmptyString(rawFile.path, 'file.path'))
    if (!path.startsWith('core_code/')) {
      throw new AppError(ErrorCodes.API_RESPONSE_INVALID, `代码蓝图文件必须位于 core_code/ 目录: ${path}`)
    }
    if (paths.has(path)) {
      throw new AppError(ErrorCodes.API_RESPONSE_INVALID, `代码蓝图包含重复文件路径: ${path}`)
    }
    paths.add(path)

    const file: CodeBlueprintFile = {
      path,
      purpose: requireNonEmptyString(rawFile.purpose, 'file.purpose'),
      mainSymbols: requireStringArray(rawFile.mainSymbols, 'file.mainSymbols'),
      mustInclude: requireStringArray(rawFile.mustInclude, 'file.mustInclude'),
      mustNotInclude: requireStringArray(rawFile.mustNotInclude, 'file.mustNotInclude'),
      inputs: optionalStringArray(rawFile.inputs, 'file.inputs'),
      outputs: optionalStringArray(rawFile.outputs, 'file.outputs'),
      assumptions: optionalStringArray(rawFile.assumptions, 'file.assumptions'),
      evidence: typeof rawFile.evidence === 'string' ? rawFile.evidence.trim() : undefined,
    }

    if (requiresHighRiskJustification(file)) {
      throw new AppError(ErrorCodes.API_RESPONSE_INVALID, `高风险文件缺少核心贡献依据: ${path}`)
    }

    return file
  })

  const omitted = Array.isArray(parsed.omitted)
    ? parsed.omitted.map((item, index) => {
        if (!isRecord(item)) {
          throw new AppError(ErrorCodes.API_RESPONSE_INVALID, `代码蓝图 omitted #${index + 1} 无效`)
        }
        return {
          item: requireNonEmptyString(item.item, 'omitted.item'),
          reason: requireNonEmptyString(item.reason, 'omitted.reason'),
        }
      })
    : undefined

  const minimalityCheck = isRecord(parsed.minimalityCheck)
    ? {
        whyTheseFilesAreMinimal: typeof parsed.minimalityCheck.whyTheseFilesAreMinimal === 'string'
          ? parsed.minimalityCheck.whyTheseFilesAreMinimal.trim()
          : undefined,
        couldAnyFileBeRemoved: typeof parsed.minimalityCheck.couldAnyFileBeRemoved === 'boolean'
          ? parsed.minimalityCheck.couldAnyFileBeRemoved
          : undefined,
        overGenerationRisk: typeof parsed.minimalityCheck.overGenerationRisk === 'string'
          ? parsed.minimalityCheck.overGenerationRisk.trim()
          : undefined,
      }
    : undefined

  return {
    paperDomain: typeof parsed.paperDomain === 'string' ? parsed.paperDomain.trim() : undefined,
    coreContribution: requireNonEmptyString(parsed.coreContribution, 'coreContribution'),
    minimalImplementationBoundary: requireNonEmptyString(parsed.minimalImplementationBoundary, 'minimalImplementationBoundary'),
    files,
    omitted,
    minimalityCheck,
  }
}

function parseTaggedCodeFiles(raw: string): GeneratedFile[] {
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

function validateFilesAgainstBlueprint(files: GeneratedFile[], blueprint: CodeBlueprint): void {
  const blueprintPaths = new Set(blueprint.files.map((file) => file.path))
  const generatedPaths = new Set<string>()

  for (const file of files) {
    if (file.content.trim() === '') {
      throw new AppError(ErrorCodes.API_RESPONSE_INVALID, `模型生成了空代码文件: ${file.path}`)
    }
    if (!blueprintPaths.has(file.path)) {
      throw new AppError(ErrorCodes.API_RESPONSE_INVALID, `模型生成了蓝图外文件: ${file.path}`)
    }
    if (generatedPaths.has(file.path)) {
      throw new AppError(ErrorCodes.API_RESPONSE_INVALID, `模型重复生成文件: ${file.path}`)
    }
    generatedPaths.add(file.path)
  }

  for (const path of blueprintPaths) {
    if (!generatedPaths.has(path)) {
      throw new AppError(ErrorCodes.API_RESPONSE_INVALID, `模型未生成蓝图声明的文件: ${path}`)
    }
  }
}

function removePartialEndTagSuffix(content: string, endTag: string): string {
  const max = Math.min(endTag.length - 1, content.length)

  for (let i = max; i > 0; i -= 1) {
    if (endTag.startsWith(content.slice(-i))) {
      return content.slice(0, -i)
    }
  }

  return content
}

function getStreamingSummary(raw: string): string {
  const start = raw.indexOf(SUMMARY_START)
  if (start === -1) return ''

  const contentStart = start + SUMMARY_START.length
  const end = raw.indexOf(SUMMARY_END, contentStart)

  if (end !== -1) {
    return raw.slice(contentStart, end)
  }

  return removePartialEndTagSuffix(raw.slice(contentStart), SUMMARY_END)
}

function extractTaggedContent(raw: string, startTag: string, endTag: string, errorMessage: string): string {
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

function parseCodeDecision(raw: string): { needed: boolean; reason?: string } {
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
