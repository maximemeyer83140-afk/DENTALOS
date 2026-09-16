/**
 * A tenant scope derived from an authenticated, permission-checked session — never from a
 * client-supplied parameter. See apps/web/src/lib/rbac.ts (`requirePermission`), the only place
 * allowed to construct one from a request. Every repository takes this instead of raw ids so a
 * missing filter is a type error, not a runtime data leak.
 */
export interface TenantContext {
  organizationId: string;
  clinicId: string;
}
