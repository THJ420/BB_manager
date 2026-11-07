import { MenuItem } from '../types';
import { categoriesFromMenu, mergeCategoryNames } from '../lib/domain';
import { COLLECTIONS } from './collections';
import { pb, isPocketBaseConfigured } from './pocketbase';
import { scopeWritePayload } from './branchScope';

/**
 * Categories are data, not a hardcoded list.
 *
 * The primary source is the branch's live `menu_items` snapshot (so categories
 * created in the Laravel admin or on the website appear here immediately). If
 * a dedicated `categories` collection exists in PocketBase, its records are
 * merged in too - that is where a staff member's brand-new category is stored
 * so it survives even before a menu item uses it.
 *
 * Every PocketBase call is best-effort: an older deployment without the
 * collection, a demo session or an offline terminal must still show the
 * derived categories and must still be able to save a menu item.
 */

export function normalizeCategoryName(value: string): string {
  return value.trim().replace(/\s+/g, ' ').slice(0, 80);
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/** Branch categories from PocketBase merged with categories in use locally. */
export async function fetchBranchCategories(
  branchId: string,
  menuItems: MenuItem[]
): Promise<string[]> {
  const derived = categoriesFromMenu(menuItems);

  if (!isPocketBaseConfigured || !branchId) return derived;

  try {
    const records = await pb.collection(COLLECTIONS.categories).getFullList(200, {
      filter: pb.filter('branch_id = {:branchId}', { branchId }),
      sort: 'name',
    });
    const upstream = records.map((record) => String((record as { name?: unknown }).name ?? ''));
    return mergeCategoryNames(derived, upstream);
  } catch {
    // Collection missing / forbidden / offline - derived categories still work.
    return derived;
  }
}

/**
 * Persist a staff-created category upstream. Returns false when the
 * collection is unavailable; the category is still saved on the menu item
 * itself, so it reaches PocketBase, the webhook and the Laravel backend anyway.
 */
export async function createCategoryUpstream(
  branchId: string,
  rawName: string
): Promise<boolean> {
  const name = normalizeCategoryName(rawName);
  if (!name || !isPocketBaseConfigured || !branchId) return false;

  try {
    const existing = await pb.collection(COLLECTIONS.categories).getList(1, 1, {
      filter: pb.filter('branch_id = {:branchId} && name ~ {:name}', {
        branchId,
        name,
      }),
    });

    if (existing.items.length > 0) return true;

    await pb.collection(COLLECTIONS.categories).create(
      scopeWritePayload(
        COLLECTIONS.categories,
        { name, slug: slugify(name), branch_id: branchId },
        'create'
      )
    );

    return true;
  } catch {
    return false;
  }
}
