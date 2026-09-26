# MESMS vs Client PDF Blueprint — Gap Audit (verified)

Last verified: 26 September 2026

## Phase A implemented in code

| PDF item | Status |
|----------|--------|
| Landed cost (freight, customs, insurance) on PO | Live — create/edit PO, GRN updates inventory unit cost |
| Courier tracking on delivery | Live — persisted in job `stageDetails.delivery.courier` |
| Sales Enquiry → Quotation | Live — `POST /api/sales-enquiries/:id/convert-to-quotation` |
| Customer Portal | Live — customer sees own service equipment, can raise a request, view status/documents, and approve estimates |
| Credit hard-block | Live — save/send blocked when projected outstanding exceeds credit limit |
| Price category + margin save block | Live — `PRICE_CATEGORY_MULTIPLIER` and `MIN_MARGIN_PCT` (20%) on sale/estimate lines |
| Customer multi-contacts | Live — Contacts tab on customer record |
| Warehouse locations | Live — `/app/stock-transfers` groups branch + bin and creates transfers |
| Rework job | Live — completed job can create a linked rework (`originalJobId` / `isRework`) |
| Warranty original job | Live — claim can link the original service job |
| VAT / tax output | Live — Financial reports section from `invoice.tax` |

## Still later (not in this pass)

- Dashboard KPIs (TAT, productivity, gross profit, fast/slow stock)
- Automated SMTP / WhatsApp workers
- Batch/serial movement capture, damaged-stock ledger
- PostgreSQL (project uses MySQL unless client mandates migration)

See plan file `.cursor/plans/blueprint_gap_audit_*.plan.md` for phased remediation.
