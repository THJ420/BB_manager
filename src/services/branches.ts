import { Branch } from '../types';
import { isOwnerSession } from './branchScope';
import { COLLECTIONS } from './collections';
import { describePocketBaseError } from './errors';
import { mapBranchRecord } from './mappers';
import { pb, isPocketBaseConfigured } from './pocketbase';
import type { RecordModel } from 'pocketbase';

/**
 * Owner-only store provisioning. The create writes straight to PocketBase (the
 * `branches` owner create rule); the edk_sync hook then mirrors the new branch
 * onto the WordPress storefront, which writes `wordpress_store_id` back.
 * Online-only: a queued branch create could provision a duplicate storefront.
 *
 * Enjoy Doner Kebab is the only multi-branch brand — Radhuni and Crispy Chicken
 * are single-unit sites — so every store created here is an EDK branch.
 */

export interface CreateBranchInput {
  name: string;
  code: string;
  address: string;
  phone: string;
  openingHours: string;
  facebookUrl: string;
  menuDownloadUrl: string;
  mapsEmbed: string;
}

const CODE_PATTERN = /^[A-Z]{2,8}-[A-Z0-9]+(?:-[A-Z0-9]+)*$/;

/** `edk poznan` -> `EDK-POZNAN`, matching the curated branch-code format. */
export function normalizeBranchCode(value: string): string {
  return value.trim().toUpperCase().replace(/\s+/g, '-');
}

export function validateBranchCode(code: string, existingCodes: string[]): string | null {
  if (!code) return 'Enter a branch code such as EDK-POZNAN.';
  if (!CODE_PATTERN.test(code)) {
    return 'Branch code must look like EDK-POZNAN: brand prefix, dash, then city.';
  }
  if (existingCodes.some((existing) => existing.toUpperCase() === code)) {
    return `Branch code ${code} is already in use.`;
  }
  return null;
}

function validateOptionalUrl(value: string, label: string): string | null {
  if (!value) return null;
  if (!/^https?:\/\/\S+$/i.test(value)) {
    return `${label} must be a full link starting with https://`;
  }
  return null;
}

/** "Mosina" from EDK-MOSINA, for the default "{City} Enjoy Doner Kebab" name. */
export function storeNameSuggestion(code: string): string {
  const city = normalizeBranchCode(code).split('-').slice(1).join(' ').trim();
  if (!city) return '';
  const titled = city.charAt(0) + city.slice(1).toLowerCase();
  return `${titled} Enjoy Doner Kebab`;
}

export async function createOwnerBranch(
  input: CreateBranchInput,
  existingCodes: string[]
): Promise<Branch> {
  if (!isOwnerSession()) throw new Error('Only the owner can add stores.');
  if (!isPocketBaseConfigured) {
    throw new Error('Adding stores needs the live PocketBase backend.');
  }

  const name = input.name.trim();
  if (!name) throw new Error('Enter the store name.');
  const code = normalizeBranchCode(input.code);
  const codeError = validateBranchCode(code, existingCodes);
  if (codeError) throw new Error(codeError);

  const facebookUrl = input.facebookUrl.trim();
  const menuDownloadUrl = input.menuDownloadUrl.trim();
  const mapsEmbed = input.mapsEmbed.trim();
  const urlError =
    validateOptionalUrl(facebookUrl, 'Facebook page link') ||
    validateOptionalUrl(menuDownloadUrl, 'Download menu link');
  if (urlError) throw new Error(urlError);
  if (mapsEmbed && !(mapsEmbed.includes('<iframe') && mapsEmbed.includes('google.com/maps'))) {
    throw new Error('Paste the full Google Maps embed code (the <iframe …> from Share → Embed a map).');
  }

  try {
    const record = await pb.collection(COLLECTIONS.branches).create<RecordModel>({
      name,
      code,
      slug: code.toLowerCase(),
      address: input.address.trim(),
      phone: input.phone.trim(),
      opening_hours: input.openingHours.trim(),
      facebook_url: facebookUrl,
      menu_download_url: menuDownloadUrl,
      maps_embed: mapsEmbed,
      select: 'enjoydonerkebab',
      is_active: true,
      is_accepting_orders: true,
    });
    return mapBranchRecord(record);
  } catch (error) {
    const described = describePocketBaseError(error);
    if (described.kind === 'forbidden' || described.kind === 'rule') {
      return Promise.reject(
        new Error(
          'PocketBase refused the create. The owner branch-create migration may not be deployed yet.'
        )
      );
    }
    if (described.kind === 'validation' && described.detail) {
      throw new Error(described.detail);
    }
    if (described.kind === 'conflict') {
      throw new Error(`Branch code ${code} is already in use.`);
    }
    throw new Error(described.message || 'The store could not be created.');
  }
}