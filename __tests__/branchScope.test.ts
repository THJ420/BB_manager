jest.mock('../src/services/pocketbase', () => ({
  isPocketBaseConfigured: true,
  pb: {
    authStore: { record: null as unknown },
    filter: jest.fn(
      (expression: string, params: Record<string, unknown>) =>
        `${expression}::${JSON.stringify(params)}`
    ),
  },
}));

import { pb } from '../src/services/pocketbase';
import {
  BranchScopeError,
  assignedBranchId,
  canCreateMenuItems,
  canDeleteMenuItems,
  canDeleteTables,
  canEditMenuDetails,
  branchScopeFilter,
  clearAssignedBranchId,
  rememberAssignedBranchId,
  scopeWritePayload,
} from '../src/services/branchScope';

const authStore = pb.authStore as { record: Record<string, unknown> | null };

function signIn(branchId: string | null): void {
  clearAssignedBranchId();
  authStore.record = branchId ? { branch_id: branchId } : null;
}

describe('branch scope enforcement', () => {
  beforeEach(() => {
    signIn('branch_dt_01');
    (pb.filter as jest.Mock).mockClear();
  });

  it('stamps the signed-in branch onto an update that names no branch', () => {
    expect(scopeWritePayload('menu_items', { price: 12.5 }, 'update')).toEqual({
      price: 12.5,
      branch_id: 'branch_dt_01',
    });
  });

  it('stamps the signed-in branch onto creates', () => {
    expect(
      scopeWritePayload('menu_items', { name: 'Truffle Burger' }, 'create')
    ).toEqual({ name: 'Truffle Burger', branch_id: 'branch_dt_01' });
  });

  it('keeps a full-record update legal by repeating the same branch_id', () => {
    expect(
      scopeWritePayload('menu_items', { branch_id: 'branch_dt_01', name: 'Burger' }, 'update')
    ).toEqual({ branch_id: 'branch_dt_01', name: 'Burger' });
  });

  it('refuses to write a record that belongs to another branch', () => {
    expect(() =>
      scopeWritePayload('menu_items', { branch_id: 'branch_ub_02', price: 9 }, 'update')
    ).toThrow(BranchScopeError);
  });

  it('omits branch_id on order updates because the PocketBase guard forbids it', () => {
    expect(
      scopeWritePayload(
        'orders',
        { branch_id: 'branch_dt_01', status: 'ready', ready_at: 'now' },
        'update'
      )
    ).toEqual({ status: 'ready', ready_at: 'now' });
  });

  it('refuses every mutation when the account has no branch assignment', () => {
    signIn(null);
    expect(() => scopeWritePayload('menu_items', { price: 1 }, 'update')).toThrow(
      BranchScopeError
    );
  });

  it('prefers the auth record over the restored-session fallback', () => {
    rememberAssignedBranchId('branch_we_03');
    expect(assignedBranchId()).toBe('branch_dt_01');

    authStore.record = null;
    expect(assignedBranchId()).toBe('branch_we_03');
  });

  it('mirrors the PocketBase menu permissions per role', () => {
    expect(canCreateMenuItems('manager')).toBe(true);
    expect(canCreateMenuItems('kitchen_lead')).toBe(true);
    expect(canCreateMenuItems('floor_staff')).toBe(false);
    expect(canEditMenuDetails('manager')).toBe(true);
    expect(canEditMenuDetails('kitchen_lead')).toBe(false);
    expect(canEditMenuDetails('floor_staff')).toBe(false);
    expect(canDeleteMenuItems('manager')).toBe(true);
    expect(canDeleteMenuItems('kitchen_lead')).toBe(true);
    expect(canDeleteMenuItems('floor_staff')).toBe(false);
    expect(canDeleteTables('manager')).toBe(true);
    expect(canDeleteTables('kitchen_lead')).toBe(true);
    expect(canDeleteTables('floor_staff')).toBe(false);
  });

  it('builds realtime filters from the authenticated branch only', () => {
    expect(branchScopeFilter('branch_dt_01')).toContain('"branchId":"branch_dt_01"');
    expect(() => branchScopeFilter('branch_ub_02')).toThrow(BranchScopeError);
  });
});
