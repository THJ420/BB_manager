export const PB_URL = (
  process.env.EXPO_PUBLIC_PB_URL ?? 'https://pocket.enjoydonerkebab.pl'
).replace(/\/+$/, '')

export const APP_TIME_ZONE = 'Europe/Warsaw'
export const AUTH_REFRESH_MS = 6 * 60 * 60 * 1000
export const POLL_INTERVAL_MS = 30_000
export const OUTBOX_INTERVAL_MS = 10_000
export const SSE_RETRY_MAX_MS = 30_000
export const ORDER_CACHE_DAYS = 14
export const ORDER_PAGE_SIZE = 200
export const OUTBOX_MAX_ATTEMPTS = 5
export const OUTBOX_BACKOFF_SECONDS = [2, 5, 15, 60, 300]

export const DB_NAME = 'bb-manager.db'
export const AUTH_STORAGE_KEY = 'pb_auth'
export const NOTIFICATION_CHANNEL_ID = 'orders'
