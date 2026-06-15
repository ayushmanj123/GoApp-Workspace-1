/** HTTP header names used for tenant context propagation. */
export const TENANT_HEADERS = {
  tenantId: 'X-Tenant-ID',
  userId: 'X-User-ID',
  organizationId: 'X-Organization-ID',
  requestId: 'X-Request-ID',
} as const;

/**
 * Tenant-scoped identity extracted from JWT claims or request headers.
 * Values are populated at runtime — never hardcoded in application code.
 */
export interface TenantContext {
  tenantId: string;
  userId: string;
  organizationId: string;
  requestId: string;
}

/** Returns true when the tenant context contains a non-empty tenant ID. */
export function hasTenantId(ctx: TenantContext | null | undefined): boolean {
  return Boolean(ctx?.tenantId);
}
