export function clamp(value: number, min: number, max: number): number {
  if (max < min) return min
  return Math.min(Math.max(value, min), max)
}

export function readStoredNumber(
  key: string,
  fallback: number,
  storage: Pick<Storage, 'getItem'> = window.localStorage
): number {
  let stored: string | null = null
  try {
    stored = storage.getItem(key)
  } catch {
    return fallback
  }

  if (!stored) return fallback

  const parsed = Number(stored)
  return Number.isFinite(parsed) ? parsed : fallback
}
