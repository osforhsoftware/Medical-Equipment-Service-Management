/**
 * Feature flags for product surfaces.
 *
 * Customer Portal is live. Portal APIs stay scoped to the signed-in
 * customer's own records. Set CUSTOMER_PORTAL_ENABLED to false to reject
 * customer login and return 503 from /api/domain/portal.
 */
export const CUSTOMER_PORTAL_ENABLED = true;
