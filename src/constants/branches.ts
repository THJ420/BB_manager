import { Branch } from '../types';

/** Multi-branch directory mirrored from the PocketBase `branches` collection. */
export const BRANCHES: Branch[] = [
  {
    id: 'branch_dt_01',
    name: 'Downtown Flagship',
    code: 'DT-01',
    address: '402 Market Street, Financial District',
    phone: '+1 (555) 902-1100',
    isActive: true,
  },
  {
    id: 'branch_ub_02',
    name: 'Uptown Bistro & Pickup',
    code: 'UB-02',
    address: '710 Broadway Ave, Northside',
    phone: '+1 (555) 902-2200',
    isActive: false,
  },
  {
    id: 'branch_we_03',
    name: 'Westside Express Pod',
    code: 'WE-03',
    address: '1590 West Ocean Blvd',
    phone: '+1 (555) 902-3300',
    isActive: false,
  },
];

export const DEMO_EMAIL = 'manager.downtown@bbmanager.internal';
export const DEMO_PASSWORD = 'manager1234';
export const DEMO_BRANCH_CODE = 'DT-01';
