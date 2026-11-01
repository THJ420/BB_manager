import type PocketBase from 'pocketbase'

import { AUTH_REFRESH_MS } from '@/lib/config'
import { normalizeError } from '@/lib/errors'
import type { BranchRecord, StaffRecord } from '@/types/models'
import { getPb } from '@/services/pocketbase'

export class AuthRequiredError extends Error {
  constructor(message = 'Sign in again to continue.') {
    super(message)
    this.name = 'AuthRequiredError'
  }
}

export class BranchLinkError extends Error {
  constructor(message = 'This account is not linked to a valid branch. Ask an administrator to set its branch.') {
    super(message)
    this.name = 'BranchLinkError'
  }
}

let lastRefreshAt = 0

export function getStaff(): StaffRecord | null {
  const pb = getPb()
  const record = pb.authStore.record as StaffRecord | null

  if (!record?.id || (record.collectionName && record.collectionName !== 'users')) {
    return null
  }

  return record
}

export function isSignedIn(): boolean {
  return getPb().authStore.isValid && getStaff() !== null
}

export async function login(email: string, password: string): Promise<{ staff: StaffRecord; branch: BranchRecord }> {
  const pb = getPb()
  const auth = await pb
    .collection('users')
    .authWithPassword<StaffRecord>(email.trim(), password)

  const staff = auth.record

  if (!staff.branch_id) {
    pb.authStore.clear()
    throw new BranchLinkError()
  }

  let branch: BranchRecord

  try {
    branch = await pb.collection('branches').getOne<BranchRecord>(staff.branch_id)
  } catch (error) {
    const normalized = normalizeError(error)
    pb.authStore.clear()

    if (normalized.kind === 'notFound') {
      throw new BranchLinkError()
    }

    throw error
  }

  lastRefreshAt = Date.now()

  return { staff, branch }
}

export async function loadBranch(branchId: string): Promise<BranchRecord> {
  return getPb().collection('branches').getOne<BranchRecord>(branchId)
}

export async function refreshAuth(): Promise<void> {
  const pb = getPb()

  if (!pb.authStore.isValid) {
    throw new AuthRequiredError()
  }

  try {
    await pb.collection('users').authRefresh<StaffRecord>()
    lastRefreshAt = Date.now()
  } catch (error) {
    const normalized = normalizeError(error)

    if (normalized.kind === 'network') {
      throw error
    }

    pb.authStore.clear()
    throw new AuthRequiredError()
  }
}

export async function ensureFreshAuth(force = false): Promise<void> {
  const pb = getPb()

  if (!pb.authStore.isValid) {
    throw new AuthRequiredError()
  }

  if (!force && Date.now() - lastRefreshAt < AUTH_REFRESH_MS) {
    return
  }

  await refreshAuth()
}

export function logout(): void {
  const pb = getPb()
  pb.authStore.clear()
  lastRefreshAt = 0
}

export function markAuthFresh(): void {
  lastRefreshAt = Date.now()
}

export type PocketBaseClient = PocketBase
