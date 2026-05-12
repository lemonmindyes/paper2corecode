export function formatElapsedTime(totalSeconds: number): string {
  const safeSeconds = Math.max(0, totalSeconds)
  const hours = Math.floor(safeSeconds / 3600)
  const minutes = Math.floor((safeSeconds % 3600) / 60)
  const seconds = safeSeconds % 60
  const mm = String(minutes).padStart(2, '0')
  const ss = String(seconds).padStart(2, '0')

  if (hours > 0) {
    return `${String(hours).padStart(2, '0')}:${mm}:${ss}`
  }

  return `${mm}:${ss}`
}

export function formatTokenCount(value: number | undefined): string {
  return value === undefined ? '-' : value.toLocaleString()
}

export function getTokenTotal(usage: TokenUsage | null): number | undefined {
  if (!usage) return undefined
  if (usage.totalTokens !== undefined) return usage.totalTokens
  if (usage.promptTokens !== undefined && usage.completionTokens !== undefined) {
    return usage.promptTokens + usage.completionTokens
  }
  return undefined
}
