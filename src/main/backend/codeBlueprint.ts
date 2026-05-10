import { CodeBlueprint, CodeBlueprintFile, GeneratedFile } from './codeCache'
import { AppError, ErrorCodes } from './errors'

export const BLUEPRINT_START = '<P2CC_CODE_BLUEPRINT>'
export const BLUEPRINT_END = '</P2CC_CODE_BLUEPRINT>'

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

export function extractJsonObject(raw: string): unknown {
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

export function validateGeneratedFilePath(filePath: string): string {
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

export function parseCodeBlueprint(raw: string): CodeBlueprint {
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

export function validateFilesAgainstBlueprint(files: GeneratedFile[], blueprint: CodeBlueprint): void {
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
