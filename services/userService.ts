import { UserAccount, UserRole, StaffPermissions } from '../types';

export const DEFAULT_ADMIN_PERMISSIONS: StaffPermissions = {
  canManageInvoices: true,
  canManageExpenses: true,
  canManageClients: true,
  canViewStatements: true,
  canUseAI: true,
  canAccessSettings: true,
};

export const DEFAULT_STAFF_PERMISSIONS: StaffPermissions = {
  canManageInvoices: true,
  canManageExpenses: true,
  canManageClients: true,
  canViewStatements: false,
  canUseAI: true,
  canAccessSettings: false,
};

export const INITIAL_USERS: UserAccount[] = [
  {
    id: 'u-admin-1',
    username: 'admin',
    name: 'Administrator',
    password: 'admin123',
    role: UserRole.ADMIN,
    email: '',
    phone: '',
    permissions: DEFAULT_ADMIN_PERMISSIONS,
    createdAt: new Date().toISOString().split('T')[0]
  }
];

export const loadStoredUsers = (): UserAccount[] => {
  const saved = localStorage.getItem('af_user_accounts');
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    } catch (e) {
      console.error('Failed to parse users', e);
    }
  }
  return INITIAL_USERS;
};

export const saveStoredUsers = (users: UserAccount[]): void => {
  localStorage.setItem('af_user_accounts', JSON.stringify(users));
};
