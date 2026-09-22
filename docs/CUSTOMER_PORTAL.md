# Customer Portal (disabled)

The Customer Portal (`/portal`) is implemented but **disabled for now** per client direction (“for future, Disable Now”). Portal source under `frontend/src/pages/portal/` is retained for a later re-enable.

Staff app (`/app`) is unaffected.

## Current behavior

- `/portal` and `/portal/*` redirect to `/login`.
- Customer-role login is rejected (frontend + backend) with a temporary-unavailable message.
- Existing customer sessions are signed out when they hit `/login`.
- `GET /api/domain/portal` returns 503.
- Customer role is omitted from estimate decision API access and from the Users UI create/edit role picker.
- Creating/updating a user with the `customer` role via API is rejected while disabled.
- Portal page components remain in the repo; they are simply not mounted.

## How to re-enable

1. Set the flag to `true` in **both** places:
   - `frontend/src/config/features.ts` → `CUSTOMER_PORTAL_ENABLED = true`
   - `backend/src/config/features.ts` → `CUSTOMER_PORTAL_ENABLED = true`
2. Restart frontend and backend so the change is loaded.
3. Smoke-test:
   - Log in as a `customer` user → lands on `/portal`.
   - Open Overview, Equipment, Estimates, History.
   - Approve/reject an estimate from the portal (uses `POST /api/domain/estimates/:id/decisions`).
   - Confirm staff `/app` still works for non-customer roles.
4. (Optional) Create or reactivate a customer portal user in **Users** (role “Customer Portal”).

No other code changes are required if the flag wiring is left intact.
