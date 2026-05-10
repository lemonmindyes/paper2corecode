import { describe, it, expect, beforeEach } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import { tmpdir } from 'os'
import { writeCodeFolder } from '../exportCode'
import { cacheCodeBundle, clearCache, CodeBlueprint } from '../codeCache'

function tempDir(): string {
  return path.join(tmpdir(), `p2cc-export-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`)
}

const dummyBlueprint: CodeBlueprint = {
  coreContribution: 'A novel contrastive loss',
  minimalImplementationBoundary: 'Only the loss function, no training pipeline',
  files: [
    {
      path: 'core_code/loss.py',
      purpose: 'Implement the proposed contrastive loss',
      mainSymbols: ['contrastive_loss'],
      mustInclude: ['temperature scaling', 'positive pair aggregation'],
      mustNotInclude: ['model definition', 'training loop'],
      inputs: ['anchor embeddings', 'positive embeddings', 'negative embeddings'],
      outputs: ['scalar loss value'],
      assumptions: ['Embeddings are L2-normalized before input'],
      evidence: 'Section 3.2, Eq. 7',
    },
  ],
  omitted: [
    { item: 'Training loop', reason: 'Not part of the proposed method' },
    { item: 'Dataset loader', reason: 'Standard vision dataset, not a contribution' },
  ],
  minimalityCheck: {
    whyTheseFilesAreMinimal: 'The loss function is the only novel component',
    couldAnyFileBeRemoved: false,
    overGenerationRisk: 'low',
  },
}

describe('writeCodeFolder', () => {
  beforeEach(() => {
    clearCache()
  })

  it('returns error when no cached code bundle', () => {
    const result = writeCodeFolder(tempDir())
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('No cached core code found')
    }
  })

  it('exports files and README without blueprint', () => {
    cacheCodeBundle({
      readme: '# Test Summary\n\nPaper content',
      files: [{ path: 'core_code/loss.py', content: 'def loss(): pass' }],
    })

    const output = tempDir()
    const result = writeCodeFolder(output)
    expect(result.ok).toBe(true)

    const readmePath = path.join(output, 'README.md')
    const codePath = path.join(output, 'core_code', 'loss.py')

    expect(fs.existsSync(readmePath)).toBe(true)
    expect(fs.existsSync(codePath)).toBe(true)
    expect(fs.readFileSync(readmePath, 'utf-8')).toBe('# Test Summary\n\nPaper content')
    expect(fs.readFileSync(codePath, 'utf-8')).toBe('def loss(): pass')

    fs.rmSync(output, { recursive: true, force: true })
  })

  it('exports files and README with blueprint', () => {
    cacheCodeBundle({
      readme: '# Test Summary',
      files: [{ path: 'core_code/loss.py', content: 'def loss(): pass' }],
      blueprint: dummyBlueprint,
    })

    const output = tempDir()
    const result = writeCodeFolder(output)
    expect(result.ok).toBe(true)

    const readmePath = path.join(output, 'README.md')
    const readmeContent = fs.readFileSync(readmePath, 'utf-8')

    expect(readmeContent).toContain('# Test Summary')
    expect(readmeContent).toContain('## Core Code Scope')
    expect(readmeContent).toContain('A novel contrastive loss')
    expect(readmeContent).toContain('Only the loss function, no training pipeline')
    expect(readmeContent).toContain('core_code/loss.py')
    expect(readmeContent).toContain('contrastive_loss')
    expect(readmeContent).toContain('Training loop')
    expect(readmeContent).toContain('Dataset loader')

    fs.rmSync(output, { recursive: true, force: true })
  })

  it('rejects file with unsafe path and returns error', () => {
    cacheCodeBundle({
      readme: '# Unsafe',
      files: [{ path: '../outside.py', content: 'bad' }],
    })

    const output = tempDir()
    const result = writeCodeFolder(output)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('Unsafe')
    }

    fs.rmSync(output, { recursive: true, force: true })
  })

  it('creates nested directories for generated files', () => {
    cacheCodeBundle({
      readme: '# Nested',
      files: [
        { path: 'core_code/loss.py', content: 'def l(): pass' },
        { path: 'core_code/utils/math.py', content: 'def add(): pass' },
      ],
    })

    const output = tempDir()
    const result = writeCodeFolder(output)
    expect(result.ok).toBe(true)

    expect(fs.existsSync(path.join(output, 'core_code', 'loss.py'))).toBe(true)
    expect(fs.existsSync(path.join(output, 'core_code', 'utils', 'math.py'))).toBe(true)

    fs.rmSync(output, { recursive: true, force: true })
  })
})
