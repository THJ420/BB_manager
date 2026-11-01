import AsyncStorage from '@react-native-async-storage/async-storage'
import PocketBase, { AsyncAuthStore } from 'pocketbase'
import EventSource from 'react-native-sse'

import { AUTH_STORAGE_KEY, PB_URL } from '@/lib/config'

// PocketBase's realtime service needs an EventSource implementation. It must be
// installed before the client attempts to open an SSE connection.
;(globalThis as unknown as { EventSource: unknown }).EventSource = EventSource

let client: PocketBase | null = null

export async function initPocketBase(): Promise<PocketBase> {
  if (client) {
    return client
  }

  const initial = await AsyncStorage.getItem(AUTH_STORAGE_KEY)

  const authStore = new AsyncAuthStore({
    save: async (serialized) => {
      await AsyncStorage.setItem(AUTH_STORAGE_KEY, serialized)
    },
    clear: async () => {
      await AsyncStorage.removeItem(AUTH_STORAGE_KEY)
    },
    initial: initial ?? '',
  })

  client = new PocketBase(PB_URL, authStore)
  client.autoCancellation(false)

  return client
}

export function getPb(): PocketBase {
  if (!client) {
    throw new Error('PocketBase has not been initialized yet.')
  }

  return client
}

export function isPocketBaseInitialized(): boolean {
  return client !== null
}
