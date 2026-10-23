# MEMS full-site audit

**Date:** 20 October 2026  
**Scope:** Frontend (`frontend/src`) and backend (`backend/src`) of Medical Equipment Service Management  
**Method:** Code review of routes, services, pages, and API contracts; `tsc` on both sides; backend test suite

This report covers functional bugs, logic errors, missing or mismatched features, API contract health, and UI/UX issues. Findings were verified in source, not guessed.

---

## Snapshot

| Check | Result |
| --- | --- |
| Backend TypeScript | Clean |
| Backend tests | **61 / 61 pass** |
| Frontend TypeScript (`tsc -b` / `tsc -p tsconfig.app.json`) | **~45 errors across 14 files** |
| Frontend `npm run build` typecheck | **Does nothing** (`tsc` on a solution `tsconfig.json` with `"files": []`) |
| Frontend ↔ backend API paths/methods | **Aligned** (~130 calls; including new inventory bulk import) |
| Auth + tenant on API routes | Present on every route file |

| Severity | Count | Meaning |
| --- | --- | --- |
| Critical | 2 | Crashes a page or permanently corrupts stock |
| High | 11 | Wrong data, broken filters, or unrecoverable workflow |
| Medium | 14 | Incorrect totals, skipped guards, or silent drift |
| Low | 5 | Polish, consistency, validation hygiene |

---

## What is healthy

- Estimate / invoice / landed-cost math is correct and defensive.
- The ticket state machine itself is sound (tests cover legal transitions and role gates).
- Every backend route file mounts `authenticate` + `resolveTenant`.
- Frontend mutations generally use try/catch with `toast.apiError`.
- Navigation targets resolve to real `App.tsx` routes (no 404 dead-ends).
- New inventory bulk import payload, schema, and result shape match end-to-end.

Problems cluster in **delete paths**, **sales-desk flows that bypass estimate-decision**, **first-page-only client stats**, and a **frontend build that never typechecks**.

---

## Critical

### C1. Inventory edit deep-link crashes the page

- **File:** `frontend/src/pages/app/Inventory.tsx` (lines 299, 467, 485)
- **What happens:** The page does `const [searchParams] = useSearchParams()` but `closeDialog()` and the `?edit=` effect both call `setSearchParams(...)`, which is never defined.
- **User impact:** Opening `/app/inventory?stage=parts&edit=<id>` then closing the dialog (or a failed load) throws `ReferenceError` and white-screens Inventory.
- **Fix:** Destructure `const [searchParams, setSearchParams] = useSearchParams()`.

### C2. Sales delivery under-deducts stock on partial reservations

- **File:** `backend/src/services/sales.service.ts` (`deliver`, ~742–806)
- **What happens:** Delivery consumes each reservation’s remaining qty, then deducts stock only for lines with *no* reservation. A shortage reservation (e.g. 4 reserved of a 10-unit line) issues 4; the other 6 are never deducted; the order is still marked `delivered`.
- **User impact:** On-hand stock is permanently overstated. The stock ledger is short.
- **Fix:** After consuming reservations, deduct any leftover line quantity, or refuse delivery until reserved qty covers the full line.

---

## High

### H1. Sidebar ticket filters show every ticket

- **File:** `frontend/src/config/nav.ts` lines 55–57 vs `frontend/src/pages/app/ServiceRequests.tsx` `statusesForBucket` (~159)
- **What happens:** Sidebar links use `status=pending_approval`, `assigned_engineer`, `closed`. The page filters by **bucket keys** (`approval`, `in-progress`, `completed`). Unknown keys fall back to *all* statuses.
- **User impact:** “Approval”, “In Progress”, and “Completed” in the sidebar look like filters but show the full list. The status dropdown goes blank. Dashboard links use the correct keys.
- **Fix:** Change those three `to` URLs to `approval`, `in-progress`, and `completed`.

### H2. Final approval can strand a ticket with no invoice

- **File:** `backend/src/services/serviceTicketWorkflow.service.ts` (`finalApproval`, ~235–266)
- **What happens:** Status is set to `pending_invoice` and a timeline event is written *before* `createInvoiceFromJob`. If invoice creation fails (e.g. incomplete billing checklist), the catch only recovers when an invoice already exists.
- **User impact:** Ticket stuck at `pending_invoice` with no invoice. Retrying final approval fails the status guard.
- **Fix:** Create the invoice first (or wrap both in one transaction) and only then move the ticket.

### H3. Deleting an estimate orphans stock reservations

- **File:** `backend/src/services/estimates.service.ts` ~164–167
- **What happens:** Delete has no status or reservation check. `StockReservation.estimateId` is `onDelete: SetNull`, so reservations survive unlinked and `inventoryItem.reserved` stays inflated.
- **User impact:** Available stock looks lower than it is, forever, unless someone edits counters by hand (which hits H5).

### H4. Deleting an in-transit transfer loses dispatched stock

- **File:** `backend/src/services/stockTransfers.service.ts` ~52–55
- **What happens:** Dispatch decrements source `inStock`. Delete has no status guard, so an `inTransit` transfer can be removed after stock has already left the source and before it arrives at the destination.

### H5. Inventory update rewrites `inStock` with no ledger

- **File:** `backend/src/services/inventory.service.ts` (`update`, ~427)
- **What happens:** `adjustStock` writes a `StockMovement`. `update` accepts `inStock` from the body and writes it silently.
- **User impact:** Anyone with inventory manage can change on-hand qty with no audit trail. Ledger `balanceAfter` no longer matches reality.

### H6. Rejecting a sales quote never releases reserved stock

- **File:** `backend/src/services/sales.service.ts` (`rejectQuote`, ~580–613)
- **What happens:** Estimate rejection releases reservations. Sales-desk `rejectQuote` only flips status to `rejected`. Reserved qty stays locked.

### H7. Revising an approved quote keeps stale reservations

- **File:** `backend/src/services/sales.service.ts` (`updateQuote`, ~484–577)
- **What happens:** An approved quote can be edited back to `draft`. Lines are recreated; old reservations keep stale quantities. Re-approval can reserve again on top.

### H8. Inventory overview stats use only the first 100 SKUs

- **File:** `frontend/src/pages/app/Inventory.tsx` ~340–362
- **What happens:** `statsQuery` fetches `{ limit: 100, page: 1 }`. Low stock, on-hand value, reserved / issued / damaged, and class totals are client reductions of that page.
- **User impact:** Any catalog over 100 items shows wrong KPI cards with no warning.

### H9. Estimate “sold below cost” guard has a 100-item blind spot

- **File:** `frontend/src/pages/app/EstimateBuilder.tsx` ~142, 256–289
- **What happens:** Inventory is loaded with `limit: 100`. Margin analysis skips lines whose item is not in that list. That same check gates “Send quotation”.
- **User impact:** Items outside the first 100 can be quoted below cost with no block. Item pickers are capped at 100 too.

### H10. Production build typechecks nothing

- **Files:** `frontend/package.json` (`"build": "tsc && vite build"`), `frontend/tsconfig.json` (`"files": []` + project references)
- **What happens:** Plain `tsc` (no `-b`) checks zero files. `tsc -b` / `tsc -p tsconfig.app.json` reports 40+ errors — including C1.
- **User impact:** The crash and form-type mismatches can ship. Vite `npm run dev` does not catch them.

### H11. Quick-add customer errors do not clear while typing

- **File:** `frontend/src/components/sales/QuickAddCustomerDialog.tsx` ~150–205
- **What happens:** Fields call `handleChange("name")` with one argument; the hook needs `(field, values)`. Revalidation runs against `undefined`. `FormFieldError` is also missing the required `field` prop, so `aria-describedby` is broken.

---

## Medium

| ID | Area | Issue | File |
| --- | --- | --- | --- |
| M1 | Inventory | Bulk import duplicate-SKU check loads only the default branch; other-branch rows skip or 500 | `inventory.service.ts` ~185–320 |
| M2 | Inventory | `branchId` is never validated as belonging to the tenant on create / update / bulk import | `inventory.service.ts` |
| M3 | Transfers | Dispatch availability uses a pre-loop snapshot; two lines for the same item can drive stock negative | `domain.service.ts` ~963–971 |
| M4 | Billing | AMC coverage matched by `customerName`, not `customerId` — same name shares cover; rename loses it | `domain.service.ts` ~1574–1582 |
| M5 | Purchasing | Received / partial POs can be hard-deleted; receipts and audit trail go away, stock stays | `purchaseOrders.service.ts` ~124–127 |
| M6 | Jobs | Job delete ignores `qtyIssued` on parts requests; issued counters cannot be reversed | `jobs.service.ts` ~818–862 |
| M7 | Sales | `convertQuote` allows draft / pending quotes to become confirmed orders | `sales.service.ts` ~632–641 |
| M8 | Tickets | `customer.activeJobs` increments on create and decrements only on delete — never on close / cancel / invoice | `serviceRequests.service.ts` |
| M9 | Estimates UI | Negative-margin alert prints `$` while the app currency is ₹ | `EstimateBuilder.tsx` ~500 |
| M10 | Dashboard | Active job rows go to `/app/jobs` instead of `/app/jobs/:id` | `Dashboard.tsx` ~971 |
| M11 | Users | Role filter lists 8 roles and omits `qa` | `Users.tsx` ~18–28 |
| M12 | Notifications | `notification.type === "amc"` is unreachable; AMC links fall through to tickets | `notificationLink.ts` ~147 |
| M13 | Inventory UI | `URL.createObjectURL` in render, never revoked — leak on every dialog keystroke | `Inventory.tsx` ~1120 |
| M14 | Forms | Expenses, commissions, catalog, and PO forms pass string amounts where the client types numbers (10+ TS errors) | Several pages |

Related type-level mismatches (build blockers, may or may not fail at runtime depending on backend coercion):

- `JobDetail.tsx` sends `checklist` and `courier` fields not in the API types; extras `type: "custom"` is missing from the client type (backend does accept `custom`).
- `BillingJobDetail.tsx` equipment-create payload is typed without required `name` / `serialNumber`.
- `MobileDashboard.tsx` reads `.next` / `.nextLabel` on a delivery status that has neither — can throw when a job is in delivery.
- `UserForm.tsx` reads `customerId` from a form type that does not include it.

---

## Low

| ID | Issue | File |
| --- | --- | --- |
| L1 | Dates formatted with ad-hoc `toLocaleDateString` instead of shared `formatDate` / `formatDateTime` | Equipment, AuditLogs, Notifications, InspectionSignaturePanel |
| L2 | Inventory image preview is a clickable `div` (no button role, no keyboard) | `Inventory.tsx` ~682–697 |
| L3 | List loading is a spinner on Users / ServiceRequests, skeletons on Dashboard, DataTable loading on Inventory | Several list pages |
| L4 | AMC and Supplier create/update have no Zod validation — bad bodies become Prisma 500s. Frontend AMC create/update helpers are unused | `amc.routes.ts`, `suppliers.routes.ts` |
| L5 | Final-approval invoice currency defaults to `USD`; every other invoice path defaults to INR | `serviceTicketWorkflow.service.ts` ~250 |

Other low notes (not tabled above): reference/SKU generation can race and 500 (only service-request create retries); cancel from `pending_invoice` gives a misleading 409; sales invoices use `INV-${Date.now().toString(36)}` instead of the sequential generator; legacy stock transfers can be dispatched with zero line items; reserved inventory items can be soft-deleted.

---

## Missing / mismatched features (user-visible)

These are not “coming soon” stubs. They look implemented and then do the wrong thing:

1. **Sidebar Approval / In Progress / Completed** — present, but do not filter (H1).
2. **Inventory KPI strip** — present, but wrong after 100 SKUs (H8).
3. **Sold-below-cost protection** — present, but skipped for most of the catalog (H9).
4. **QA user filter** — QA role exists in the product; Users page cannot filter it (M11).
5. **Dashboard job click** — looks like a drill-down; opens the list (M10).
6. **AMC notification deep-link** — type exists; routing never reaches it (M12).
7. **Customer “active jobs”** — displayed, but the counter only goes up (M8).

Unused backend surfaces (not bugs, just dead): `GET /api/inventory/low-stock`, `GET /api/billing/summary`, `GET /api/domain/projects/:requestId`.

---

## UI / design issues

- **Currency:** one Estimate Builder warning uses `$`; everywhere else uses ₹ via `formatCurrency`.
- **Loading:** three patterns for the same kind of list page.
- **Dates:** some pages use the shared formatter, others use browser locale strings.
- **Accessibility:** inventory image cell is not a button; quick-add customer errors are not wired to fields.
- **Bulk import dialog:** cannot cancel a long upload; images upload before the bulk call, so a failed import leaves orphan files.
- **No route 404s** from in-app links. `NotFound.tsx` is only for unknown URLs.

Layout was reviewed from code, not a live click-through of every screen. The running Vite app was not used as the primary evidence for this report.

---

## Frontend TypeScript errors that block a real typecheck

`npx tsc -b --noEmit` in `frontend/` currently fails. Highest-signal files:

| File | What it points to |
| --- | --- |
| `Inventory.tsx` | C1 — `setSearchParams` missing |
| `QuickAddCustomerDialog.tsx` | H11 — wrong `handleChange` / `FormFieldError` usage |
| `EstimateBuilder.tsx` / `EstimateItemsTable.tsx` | Schema / `costPrice` not on line type |
| `ExpensesCommissions.tsx` | String amounts vs number types (M14) |
| `ServiceCatalog.tsx` | `unitPrice` / `taxRate` as string \| number |
| `JobDetail.tsx` | Extra `checklist` / `courier`; `custom` extra type |
| `BillingJobDetail.tsx` | Incomplete equipment payload type |
| `PurchaseOrderDetail.tsx` / `PurchaseOrdersProfessional.tsx` | Zod schemas missing `received` / `lines` |
| `MobileDashboard.tsx` | Delivery status has no `next` |
| `UserForm.tsx` | `customerId` not on form type |
| `notificationLink.ts` | Dead AMC branch (M12) |

---

## Recommended fix order

1. **C1** — one-line Inventory crash fix.
2. **H1** — three sidebar query values.
3. **C2, H6, H7** — sales stock reservation / delivery so inventory cannot silently drift.
4. **H2** — make final approval atomic so tickets cannot get stuck.
5. **H3, H4, H5, M5, M6** — block destructive deletes and stop silent `inStock` writes.
6. **H8, H9** — drive inventory stats and estimate pickers from server aggregates / search, not `limit: 100`.
7. **H10** — switch build to `tsc -b` after burning down the existing errors.
8. Remaining medium/low polish (currency, Users QA filter, dashboard job links, dates, a11y).

---

## How this was produced

- Backend compile + `npm test` (61 passed).
- Frontend `tsc -b --noEmit` (failed; errors listed above).
- Route-by-route frontend `api.ts` vs `backend/src/routes`.
- Focused reads of inventory, sales, estimates, workflow, jobs, POs, transfers, ServiceRequests, EstimateBuilder, Dashboard, Users, and nav.

A browsable version of this report is also available as a Cursor canvas: `canvases/site-audit-report.canvas.tsx` (open beside chat).
