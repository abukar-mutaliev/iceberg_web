export type AccountingProfile = 'OPERATOR' | 'FINANCIER' | 'FULL';

export function resolveClientProfile(user?: {
  role?: string;
  admin?: { isSuperAdmin?: boolean; accountingProfile?: AccountingProfile | null } | null;
} | null): AccountingProfile | null {
  if (!user) return null;
  if (user.role === 'ADMIN' && user.admin?.isSuperAdmin) return 'FULL';
  if (user.role === 'ADMIN') return user.admin?.accountingProfile ?? 'OPERATOR';
  if (user.role === 'EMPLOYEE') return 'OPERATOR';
  return null;
}

export function canSeeCost(profile: AccountingProfile | null | undefined): boolean {
  return profile === 'FINANCIER' || profile === 'FULL';
}

export function canSeeProfit(profile: AccountingProfile | null | undefined): boolean {
  return profile === 'FINANCIER' || profile === 'FULL';
}

export function canManageSupplies(role?: string): boolean {
  return role === 'ADMIN' || role === 'EMPLOYEE';
}

export function canReverseSupply(profile: AccountingProfile | null | undefined): boolean {
  return profile === 'FULL';
}
