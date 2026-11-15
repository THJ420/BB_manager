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
 */

export const BRANCH_SELECT_OPTIONS = [
  { id: 'enjoydonerkebab', label: 'ENJOY DONER KEBAB' },
  { id: 'crispychicken', label: 'CRISPY CHICKEN' },
  { id: 'radhuni 2.0', label: 'RADHUNI 2.0' },
] as const;

export type BranchSelect = (typeof BRANCH_SELECT_OPTIONS)[number]['id'];

export interface CreateBranchInput {
  name: string;
  code: string;
  address: string;
  select: BranchSelect;
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

  try {
    const record = await pb.collection(COLLECTIONS.branches).create<RecordModel>({
      name,
      code,
      slug: code.toLowerCase(),
      address: input.address.trim(),
      select: input.select,
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