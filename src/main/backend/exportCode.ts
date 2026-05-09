import * as fs from 'fs'
import * as path from 'path'
import { getCachedCodeBundle } from './codeCache'

function resolveSafePath(rootDir: string, relativePath: string): string | null {
  const normalized = relativePath.replace(/\\/g, '/')
  const parts = normalized.split('/')
  const lower = normalized.toLowerCase()

  if (
    normalized.startsWith('/') ||
    /^[a-z]:/i.test(normalized) ||
    parts.includes('..') ||
    parts.includes('') ||
    lower === 'readme.md' ||
    lower.endsWith('/readme.md')
  ) {
    return null
  }

  const root = path.resolve(rootDir)
  const target = path.resolve(root, ...parts)
  return target.startsWith(root + path.sep) ? target : null
}

export function writeCodeFolder(outputDir: string): { ok: true; path: string } | { ok: false; error: string } {
  const bundle = getCachedCodeBundle()
  if (!bundle) {
    return { ok: false, error: 'No cached core code found. Please analyze a paper first.' }
  }

  try {
    fs.mkdirSync(outputDir, { recursive: true })
    fs.writeFileSync(path.join(outputDir, 'README.md'), bundle.readme, 'utf-8')

    for (const file of bundle.files) {
      const target = resolveSafePath(outputDir, file.path)
      if (!target) {
        return { ok: false, error: `Unsafe generated file path: ${file.path}` }
      }

      fs.mkdirSync(path.dirname(target), { recursive: true })
      fs.writeFileSync(target, file.content, 'utf-8')
    }

    return { ok: true, path: outputDir }
  } catch (err) {
    return { ok: false, error: `Failed to write project folder: ${(err as Error).message}` }
  }
}
