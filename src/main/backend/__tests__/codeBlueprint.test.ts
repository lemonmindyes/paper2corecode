import { describe, it, expect } from 'vitest'
import { AppError, ErrorCodes } from '../errors'
import { parseCodeBlueprint, validateFilesAgainstBlueprint, extractJsonObject, validateGeneratedFilePath } from '../codeBlueprint'

function makeMinimalBlueprintJson(): string {
  return JSON.stringify({
    coreContribution: 'a novel loss function',
    minimalImplementationBoundary: 'only the loss function, no training code',
    files: [
      {
        path: 'core_code/losses.py',
        purpose: 'implements the proposed loss function',
        mainSymbols: ['CustomLoss'],
        mustInclude: ['forward pass', 'loss computation'],
        mustNotInclude: ['training loop', 'model definition'],
        evidence: 'Section 3.1 defines the loss formulation',
      },
    ],
    omitted: [{ item: 'training script', reason: 'not part of core contribution' }],
    minimalityCheck: {
      whyTheseFilesAreMinimal: 'only one file is needed for the loss',
      couldAnyFileBeRemoved: false,
      overGenerationRisk: 'low',
    },
  })
}

describe('extractJsonObject', () => {
  it('extracts JSON from plain text', () => {
    const result = extractJsonObject('{"a": 1}')
    expect(result).toEqual({ a: 1 })
  })

  it('extracts JSON from markdown-fenced code block', () => {
    const result = extractJsonObject('```json\n{"a": 1}\n```')
    expect(result).toEqual({ a: 1 })
  })

  it('extracts JSON from fenced block without language', () => {
    const result = extractJsonObject('```\n{"b": 2}\n```')
    expect(result).toEqual({ b: 2 })
  })

  it('throws on empty input', () => {
    expect(() => extractJsonObject('')).toThrow(AppError)
  })

  it('throws on malformed JSON', () => {
    expect(() => extractJsonObject('{bad')).toThrow(AppError)
  })

  it('throws with parse detail when braces contain invalid JSON', () => {
    expect(() => extractJsonObject('{bad}')).toThrow(AppError)
  })
})

describe('validateGeneratedFilePath', () => {
  it('accepts a normal relative path', () => {
    expect(validateGeneratedFilePath('core_code/losses.py')).toBe('core_code/losses.py')
  })

  it('normalizes backslashes', () => {
    expect(validateGeneratedFilePath('core_code\\losses.py')).toBe('core_code/losses.py')
  })

  it('rejects absolute paths starting with /', () => {
    expect(() => validateGeneratedFilePath('/etc/passwd')).toThrow(AppError)
  })

  it('rejects absolute paths with drive letter', () => {
    expect(() => validateGeneratedFilePath('C:\\bad\\file.py')).toThrow(AppError)
  })

  it('rejects paths with ..', () => {
    expect(() => validateGeneratedFilePath('core_code/../outside.py')).toThrow(AppError)
  })

  it('rejects empty path parts', () => {
    expect(() => validateGeneratedFilePath('core_code//file.py')).toThrow(AppError)
  })

  it('rejects README.md', () => {
    expect(() => validateGeneratedFilePath('README.md')).toThrow(AppError)
  })

  it('rejects readme.md case insensitive', () => {
    expect(() => validateGeneratedFilePath('readme.md')).toThrow(AppError)
  })

  it('rejects subfolder readme.md', () => {
    expect(() => validateGeneratedFilePath('core_code/readme.md')).toThrow(AppError)
  })
})

describe('parseCodeBlueprint', () => {
  it('parses a valid minimal blueprint', () => {
    const blueprint = parseCodeBlueprint(makeMinimalBlueprintJson())
    expect(blueprint.coreContribution).toBe('a novel loss function')
    expect(blueprint.files).toHaveLength(1)
    expect(blueprint.files[0].path).toBe('core_code/losses.py')
    expect(blueprint.files[0].mainSymbols).toEqual(['CustomLoss'])
    expect(blueprint.omitted).toHaveLength(1)
    expect(blueprint.omitted![0].item).toBe('training script')
    expect(blueprint.minimalityCheck!.couldAnyFileBeRemoved).toBe(false)
  })

  it('accepts optional fields as undefined when absent', () => {
    const core = makeMinimalBlueprintJson()
    const parsed = JSON.parse(core)
    delete parsed.paperDomain
    delete parsed.files[0].inputs
    delete parsed.files[0].outputs
    delete parsed.files[0].assumptions
    const input = JSON.stringify(parsed)
    const blueprint = parseCodeBlueprint(input)
    expect(blueprint.paperDomain).toBeUndefined()
    expect(blueprint.files[0].inputs).toBeUndefined()
    expect(blueprint.files[0].outputs).toBeUndefined()
    expect(blueprint.files[0].assumptions).toBeUndefined()
  })

  it('throws when coreContribution is missing', () => {
    const parsed = JSON.parse(makeMinimalBlueprintJson())
    delete parsed.coreContribution
    expect(() => parseCodeBlueprint(JSON.stringify(parsed))).toThrow(AppError)
  })

  it('throws when minimalImplementationBoundary is missing', () => {
    const parsed = JSON.parse(makeMinimalBlueprintJson())
    delete parsed.minimalImplementationBoundary
    expect(() => parseCodeBlueprint(JSON.stringify(parsed))).toThrow(AppError)
  })

  it('throws when files array is empty', () => {
    const parsed = JSON.parse(makeMinimalBlueprintJson())
    parsed.files = []
    expect(() => parseCodeBlueprint(JSON.stringify(parsed))).toThrow(/缺少文件规划/)
  })

  it('throws when a file has no purpose', () => {
    const parsed = JSON.parse(makeMinimalBlueprintJson())
    delete parsed.files[0].purpose
    expect(() => parseCodeBlueprint(JSON.stringify(parsed))).toThrow(AppError)
  })

  it('throws when a file has empty mainSymbols', () => {
    const parsed = JSON.parse(makeMinimalBlueprintJson())
    parsed.files[0].mainSymbols = []
    expect(() => parseCodeBlueprint(JSON.stringify(parsed))).toThrow(AppError)
  })

  it('throws when a file path is not under core_code/', () => {
    const parsed = JSON.parse(makeMinimalBlueprintJson())
    parsed.files[0].path = 'outside.py'
    expect(() => parseCodeBlueprint(JSON.stringify(parsed))).toThrow(/必须位于 core_code/)
  })

  it('throws on duplicate file paths', () => {
    const parsed = JSON.parse(makeMinimalBlueprintJson())
    parsed.files.push({ ...parsed.files[0] })
    expect(() => parseCodeBlueprint(JSON.stringify(parsed))).toThrow(/重复/)
  })

  it('throws when a high-risk file lacks justification', () => {
    const parsed = JSON.parse(makeMinimalBlueprintJson())
    parsed.files[0].path = 'core_code/train.py'
    parsed.files[0].purpose = 'helper utility'
    expect(() => parseCodeBlueprint(JSON.stringify(parsed))).toThrow(/高风险/)
  })

  it('allows a high-risk file when purpose contains justification terms', () => {
    const parsed = JSON.parse(makeMinimalBlueprintJson())
    parsed.files[0].path = 'core_code/train.py'
    parsed.files[0].purpose = 'implements the proposed training algorithm'
    parsed.files[0].evidence = 'the paper proposes this training procedure'
    const blueprint = parseCodeBlueprint(JSON.stringify(parsed))
    expect(blueprint.files[0].path).toBe('core_code/train.py')
  })

  it('throws when omitted items are malformed', () => {
    const parsed = JSON.parse(makeMinimalBlueprintJson())
    parsed.omitted = [{ bad: 'data' }]
    expect(() => parseCodeBlueprint(JSON.stringify(parsed))).toThrow(AppError)
  })

  it('throws when input is not valid JSON', () => {
    expect(() => parseCodeBlueprint('not json')).toThrow(AppError)
  })

  it('throws when a file entry is not an object', () => {
    const parsed = JSON.parse(makeMinimalBlueprintJson())
    parsed.files = ['bad-file']

    expect(() => parseCodeBlueprint(JSON.stringify(parsed))).toThrow(/文件 #1 无效/)
  })

  it('throws when optional file arrays are present but not arrays', () => {
    const parsed = JSON.parse(makeMinimalBlueprintJson())
    parsed.files[0].inputs = 'paper tensor'

    expect(() => parseCodeBlueprint(JSON.stringify(parsed))).toThrow(/inputs 格式无效/)
  })

  it('throws when optional file arrays contain empty values', () => {
    const parsed = JSON.parse(makeMinimalBlueprintJson())
    parsed.files[0].outputs = ['']

    expect(() => parseCodeBlueprint(JSON.stringify(parsed))).toThrow(AppError)
  })

  it('throws when omitted entries are not objects', () => {
    const parsed = JSON.parse(makeMinimalBlueprintJson())
    parsed.omitted = ['training loop']

    expect(() => parseCodeBlueprint(JSON.stringify(parsed))).toThrow(/omitted #1 无效/)
  })

  it('ignores non-object minimality checks and non-string evidence', () => {
    const parsed = JSON.parse(makeMinimalBlueprintJson())
    parsed.minimalityCheck = 'minimal'
    parsed.files[0].evidence = 123

    const blueprint = parseCodeBlueprint(JSON.stringify(parsed))

    expect(blueprint.minimalityCheck).toBeUndefined()
    expect(blueprint.files[0].evidence).toBeUndefined()
  })
})

describe('validateFilesAgainstBlueprint', () => {
  const blueprint = parseCodeBlueprint(makeMinimalBlueprintJson())

  it('passes when generated files exactly match blueprint', () => {
    const files = [{ path: 'core_code/losses.py', content: 'def forward(): pass\n' }]
    expect(() => validateFilesAgainstBlueprint(files, blueprint)).not.toThrow()
  })

  it('throws when a generated file is not in blueprint', () => {
    const files = [
      { path: 'core_code/losses.py', content: 'def forward(): pass\n' },
      { path: 'core_code/extra.py', content: 'x = 1\n' },
    ]
    expect(() => validateFilesAgainstBlueprint(files, blueprint)).toThrow(/蓝图外/)
  })

  it('throws when a blueprint file is missing from generated output', () => {
    const files: { path: string; content: string }[] = []
    expect(() => validateFilesAgainstBlueprint(files, blueprint)).toThrow(/未生成/)
  })

  it('throws when a generated file has empty content', () => {
    const files = [{ path: 'core_code/losses.py', content: '' }]
    expect(() => validateFilesAgainstBlueprint(files, blueprint)).toThrow(/空代码/)
  })

  it('throws when a generated file content is only whitespace', () => {
    const files = [{ path: 'core_code/losses.py', content: '   \n  ' }]
    expect(() => validateFilesAgainstBlueprint(files, blueprint)).toThrow(/空代码/)
  })

  it('throws when there are duplicate generated file paths', () => {
    const files = [
      { path: 'core_code/losses.py', content: 'def forward(): pass\n' },
      { path: 'core_code/losses.py', content: 'def backward(): pass\n' },
    ]
    expect(() => validateFilesAgainstBlueprint(files, blueprint)).toThrow(/重复/)
  })

  it('passes when blueprint has multiple files and all are present', () => {
    const multiBlueprint = parseCodeBlueprint(JSON.stringify({
      coreContribution: 'multi-file contribution',
      minimalImplementationBoundary: 'two core files',
      files: [
        {
          path: 'core_code/losses.py',
          purpose: 'loss function',
          mainSymbols: ['Loss'],
          mustInclude: ['forward'],
          mustNotInclude: ['train'],
          evidence: 'Section 3.1',
        },
        {
          path: 'core_code/model.py',
          purpose: 'model definition',
          mainSymbols: ['Model'],
          mustInclude: ['forward'],
          mustNotInclude: ['train'],
          evidence: 'Section 3.2',
        },
      ],
    }))

    const files = [
      { path: 'core_code/losses.py', content: 'class Loss: pass\n' },
      { path: 'core_code/model.py', content: 'class Model: pass\n' },
    ]
    expect(() => validateFilesAgainstBlueprint(files, multiBlueprint)).not.toThrow()
  })
})
