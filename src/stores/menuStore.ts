import { create } from 'zustand'

import type { CachedMenu } from '@/db/menu'

interface MenuState {
  menu: CachedMenu[]
  hydrated: boolean
  setMenu: (menu: CachedMenu[]) => void
  hydrate: (menu: CachedMenu[]) => void
  upsert: (item: CachedMenu) => void
}

function sortMenu(menu: CachedMenu[]): CachedMenu[] {
  return [...menu].sort((left, right) => {
    const category = left.category.localeCompare(right.category, undefined, { sensitivity: 'base' })

    return category !== 0
      ? category
      : left.name.localeCompare(right.name, undefined, { sensitivity: 'base' })
  })
}

export const useMenuStore = create<MenuState>((set) => ({
  menu: [],
  hydrated: false,
  setMenu: (menu) => set({ menu: sortMenu(menu) }),
  hydrate: (menu) => set({ menu: sortMenu(menu), hydrated: true }),
  upsert: (item) => set((state) => {
    const index = state.menu.findIndex((entry) => entry.id === item.id)

    if (index === -1) {
      return { menu: sortMenu([...state.menu, item]) }
    }

    const next = [...state.menu]
    next[index] = item

    return { menu: sortMenu(next) }
  }),
}))
