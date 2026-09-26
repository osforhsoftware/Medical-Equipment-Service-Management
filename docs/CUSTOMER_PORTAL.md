# Customer Portal

The Customer Portal (`/portal`) is **enabled**. A customer user sees only their own service equipment, tickets, estimates, and documents.

Staff app (`/app`) is unchanged.

## What a customer can do

- Sign in and land on `/portal`.
- See **their** registered service equipment (asset, serial, warranty, status). They cannot see other customers or staff inventory.
- Submit a service request for their equipment (`POST /api/domain/portal/requests`).
- See request / job status on Overview and Service History.
- Review and approve, reject, or request revision on an estimate.
- Open their estimate and invoice documents.

## Staff setup

1. Create or edit a user in **Users**.
2. Assign role **Customer Portal** only.
3. Link the user to a customer record. Without that link, portal login returns “Customer profile is not linked”.
4. The customer must already have equipment on that record.

Demo seed user: username `portal` (St. Mary's Hospital).

## Disable later

Set both flags to `false` and restart:

- `frontend/src/config/features.ts` → `CUSTOMER_PORTAL_ENABLED = false`
- `backend/src/config/features.ts` → `CUSTOMER_PORTAL_ENABLED = false`

When disabled:

- `/portal` redirects to `/login`.
- Customer login is rejected.
- `GET /api/domain/portal` returns 503.
- Customer role cannot be assigned in Users.
