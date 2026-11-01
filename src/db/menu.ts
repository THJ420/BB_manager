import type { SQLiteDatabase } from 'expo-sqlite'

import type { MenuRecord } from '@/types/models'

export interface CachedMenu {
  id: string
  branchId: string
  name: string
  category: string
  description: string
  price: number
  isAvailable: boolean
  updated: string
}

interface MenuRow {
  id: string
  branch_id: string
  name: string | null
  category: string | null
  description: string | null
  price: number
  is_available: number
  updated: string | null
}

function rowToMenu(row: MenuRow): CachedMenu {
  return {
    id: row.id,
    branchId: row.branch_id,
    name: row.name ?? '',
    category: row.category ?? 'Uncategorised',
    description: row.description ?? '',
    price: Number(row.price),
    isAvailable: row.is_available === 1,
    updated: row.updated ?? '',
  }
}

export async function upsertMenu(db: SQLiteDatabase, record: MenuRecord): Promise<void> {
  await db.runAsync(
    `INSERT INTO menu (id, branch_id, name, category, description, price, is_available, updated)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       branch_id = excluded.branch_id,
       name = excluded.name,
       category = excluded.category,
       description = excluded.description,
       price = excluded.price,
       is_available = excluded.is_available,
       updated = excluded.updated`,
    record.id,
    record.branch_id,
    record.name ?? '',
    record.category ?? 'Uncategorised',
    record.description ?? '',
    Number(record.price ?? 0),
    record.is_available === false ? 0 : 1,
    record.updated ?? '',
  )
}

export async function replaceMenu(db: SQLiteDatabase, branchId: string, records: MenuRecord[]): Promise<void> {
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM menu WHERE branch_id = ?', branchId)

    for (const record of records) {
      await upsertMenu(db, record)
    }
  })
}

export async function listMenu(db: SQLiteDatabase, branchId: string): Promise<CachedMenu[]> {
  const rows = await db.getAllAsync<MenuRow>(
    'SELECT * FROM menu WHERE branch_id = ? ORDER BY category COLLATE NOCASE ASC, name COLLATE NOCASE ASC',
    branchId,
  )

  return rows.map(rowToMenu)
}

export async function getMenu(db: SQLiteDatabase, menuId: string): Promise<CachedMenu | null> {
  const row = await db.getFirstAsync<MenuRow>('SELECT * FROM menu WHERE id = ?', menuId)

  return row ? rowToMenu(row) : null
}

export async function deleteAllMenu(db: SQLiteDatabase): Promise<void> {
  await db.runAsync('DELETE FROM menu')
}
