const timeFormatter = new Intl.DateTimeFormat('pl-PL', {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

const dayFormatter = new Intl.DateTimeFormat('pl-PL', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
})

export function parsePbDate(value?: string | null): Date | null {
  if (!value) {
    return null
  }

  const normalized = value.includes('T') ? value : value.replace(' ', 'T')
  const date = new Date(normalized)

  return Number.isNaN(date.getTime()) ? null : date
}

export function toPbFilterDate(date: Date): string {
  return date.toISOString().replace('T', ' ')
}

export function formatTime(value?: string | Date | null): string {
  const date = value instanceof Date ? value : parsePbDate(value)

  return date ? timeFormatter.format(date) : '--:--'
}

export function formatDateTime(value?: string | Date | null): string {
  const date = value instanceof Date ? value : parsePbDate(value)

  if (!date) {
    return '--'
  }

  return `${dayFormatter.format(date)}, ${timeFormatter.format(date)}`
}

function startOfLocalDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
}

export function formatPickupDay(value?: string | null): string {
  const date = parsePbDate(value)

  if (!date) {
    return '--'
  }

  const today = startOfLocalDay(new Date())
  const target = startOfLocalDay(date)
  const dayDiff = Math.round((target - today) / 86_400_000)

  if (dayDiff === 0) {
    return 'Today'
  }

  if (dayDiff === 1) {
    return 'Tomorrow'
  }

  return dayFormatter.format(date)
}

export function minutesUntil(value?: string | null, now = Date.now()): number | null {
  const date = parsePbDate(value)

  if (!date) {
    return null
  }

  return Math.round((date.getTime() - now) / 60_000)
}

export function formatCountdown(value?: string | null, now = Date.now()): string {
  const minutes = minutesUntil(value, now)

  if (minutes === null) {
    return '--'
  }

  if (minutes < -1) {
    return `${Math.abs(minutes)} min overdue`
  }

  if (minutes <= 1) {
    return 'now'
  }

  if (minutes < 60) {
    return `in ${minutes} min`
  }

  const hours = Math.floor(minutes / 60)
  const remainder = minutes % 60

  return remainder === 0 ? `in ${hours} h` : `in ${hours} h ${remainder} min`
}

export function formatRelativeTimestamp(value?: string | null): string {
  const date = parsePbDate(value)

  if (!date) {
    return 'never'
  }

  const seconds = Math.round((Date.now() - date.getTime()) / 1000)

  if (seconds < 30) {
    return 'just now'
  }

  if (seconds < 60) {
    return `${seconds}s ago`
  }

  const minutes = Math.round(seconds / 60)

  if (minutes < 60) {
    return `${minutes} min ago`
  }

  const hours = Math.round(minutes / 60)

  return hours < 24 ? `${hours} h ago` : dayFormatter.format(date)
}
