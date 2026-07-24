# MESMS Project Scope, Roles, Workflows, and Completion Audit

Last audited: 22 July 2026  
Project: Medical Equipment Service Management System (MESMS)  
Audit basis: current frontend, backend, Prisma schema, seed data, routes, and build/test results

## 1. Purpose of this document

This is the main project scope and gap-analysis file for MESMS. It records:

- the intended business scope;
- the implemented architecture and modules;
- every user role and its expected workflow;
- the end-to-end service lifecycle;
- features that are implemented;
- features that are only partially implemented or simulated;
- known mistakes, security gaps, and technical risks;
- the work required before production release;
- recommended priorities and acceptance criteria.

This document describes the code as it exists now. A visible page, button, toast message, database model, or API route is not automatically considered a complete feature. A feature is complete only when authorization, validation, persistence, business rules, error handling, and tests all work together.

### Requirements sources used

This audit also cross-checks the code against the original specification files stored outside the Git repository:

- `Reports/Medical_Equipment_Service_SaaS_Documentation.pdf` (51 pages, dated 2 June 2026);
- `Reports/Medical_Equipment_Service_Workflow_Report.pdf` (8 pages, dated 2 June 2026);
- `user_login_details.txt`.

The PDF specification is the requirements baseline for workflows, role permissions, dashboards, report templates, inventory behavior, customer access, and future scope. These files should be copied or linked into a version-controlled `docs/` folder so the requirements cannot drift separately from the code.

## 2. Product objective

MESMS is intended to be a multi-tenant, multi-branch platform for medical-equipment service companies. It should manage the full operational lifecycle:

1. customer and equipment registration;
2. service-request intake;
3. assignment to appropriate staff;
4. equipment inspection;
5. estimate preparation and customer approval;
6. service-job scheduling and execution;
7. spare-parts reservation and stock deduction;
8. customer sign-off and service report;
9. invoicing and payment tracking;
10. AMC management, alerts, reporting, and audit history.

The target users are administrators, coordinators, inspectors, estimators, service engineers, inventory staff, billing staff, and customers.

## 3. Current technical architecture

### Frontend

- React 18, TypeScript, Vite, React Router, TanStack Query, Tailwind CSS, and shadcn/Radix UI.
- Staff application under `/app`.
- Customer portal under `/portal`.
- Cookie-based authentication calls through `frontend/src/lib/api.ts`.
- Frontend module visibility is configured through a role/module matrix.
- Some screens use live APIs, while reports, QR tracking, and the customer portal still use mock data.

### Backend

- Node.js, Express, TypeScript, Prisma, JWT, Zod, bcrypt, and cookie parsing.
- REST API under `/api`.
- Controller, service, repository, schema, and middleware layers.
- Tenant ID is taken from the authenticated JWT and applied to most repository operations.
- Approximately 94 route handlers exist across authentication, users, branches, customers, equipment, service requests, inspections, estimates, jobs, inventory, suppliers, purchase orders, transfers, AMC, billing, notifications, audit logs, settings, and dashboard modules.

### Database

- Prisma models exist for tenants, settings, users, branches, customers, equipment, service requests, inspections, estimates, service jobs, job actions, inventory, suppliers, purchase orders, stock transfers, AMC contracts, invoices, notifications, and audit logs.
- The current uncommitted Prisma schema selects MySQL.
- The schema comments, backend package description, and `.env.example` still describe PostgreSQL.
- No committed Prisma migration directory exists. A new environment therefore has no versioned database deployment history.

### Specification-to-implementation architecture decision

The original specification recommends Next.js, MongoDB, an API gateway, microservices, object storage, Docker/Kubernetes, CI/CD, caching, queues, CDN, and cloud infrastructure. The current project uses a Vite single-page application, one Express API, and Prisma with a relational database. A monolith and relational database can be appropriate for the present product size, but this is a deliberate architecture change from the specification and must be documented. Object storage, background jobs, API versioning, containers, CI/CD, monitoring, and infrastructure-as-code are not currently implemented.

### Authentication

- Login issues a JWT in an HTTP-only cookie.
- The frontend restores the session through `/api/auth/me`.
- Staff and customer users are redirected to different application areas.
- The login form currently contains a prefilled administrator username and password.

## 4. Roles and intended responsibilities

### Administrator

Expected access:

- all staff modules;
- tenant settings and company configuration;
- branch and user management;
- role/module access configuration;
- audit logs and demo-data controls;
- oversight of customers, equipment, requests, jobs, stock, contracts, billing, and reports.

Current state:

- admin pages and APIs exist;
- only user mutation routes, settings mutations, demo seed, inspection submission, and service-request assignment have explicit backend role guards;
- many other sensitive write APIs accept any authenticated staff user.

### Service Coordinator

Expected workflow:

- register or review customers and equipment;
- create service requests;
- set priority and SLA;
- assign inspectors, estimators, engineers, inventory staff, or billing staff;
- monitor request timelines;
- schedule service jobs;
- monitor AMC contracts and operational reports.

Current state:

- core request creation, assignment, timeline, workflow advancement, and job scheduling UI/API exist;
- request and job business rules are incomplete;
- API authorization does not consistently restrict coordinator-only operations.

### Inspector

Expected workflow:

- see only assigned inspection work;
- start inspection;
- capture findings, severity, recommendation, photos, and videos;
- submit a signed/traceable inspection report;
- move the request to estimation.

Current state:

- assigned request filtering and inspection-report persistence exist;
- report submission advances a request to `estimate`;
- camera and video actions explicitly show “coming soon”;
- no inspection media model or upload/storage flow exists;
- direct request detail/timeline access is not checked against assignment.

### Estimator

Expected workflow:

- see assigned requests after inspection;
- review inspection findings;
- create itemized labor and parts estimates;
- send an estimate to the customer;
- revise, reject, or approve it through controlled transitions;
- hand approved work to scheduling/inventory.

Current state:

- estimate list/create/update backend and create UI exist;
- estimate data contains only aggregate labor and parts totals, not line items;
- no actual “send estimate” delivery mechanism exists;
- customer approval is currently mock/local state only;
- revision history is not implemented beyond a numeric field;
- estimate access is tenant-wide rather than assignment/customer scoped.

### Service Engineer

Expected workflow:

- see only assigned jobs;
- start/pause/update job status and progress;
- upload before/after evidence;
- request parts;
- consume reserved stock;
- capture a real customer signature;
- complete the job and generate a service report.

Current state:

- assigned job filtering and job-level access checks exist for engineers;
- photos are stored as database data URLs;
- parts request, stock deduction, activity history, status/progress, and customer-name sign-off exist;
- “signature capture” does not capture a drawn signature in the current UI;
- “generate report PDF” only displays a toast and does not generate a file;
- stock deduction is not atomic with the deduction record and job activity;
- job deletion and activity access do not consistently enforce engineer/coordinator/admin role rules.
- the specification requires engineers to be unable to see cost price, profit margins, or internal financial data, but no field-level financial authorization policy is implemented.

### Inventory Staff

Expected workflow:

- maintain parts and stock by branch;
- receive approved parts requirements;
- reserve stock;
- create purchase orders;
- receive purchase orders and increase stock;
- transfer stock between branches;
- process engineer parts requests;
- receive low-stock alerts.

Current state:

- inventory, supplier, purchase-order, stock-transfer models and CRUD APIs exist;
- create/list UIs exist for the main supply-chain modules;
- supplier delete exists in the UI;
- receiving, partial receiving, reservation, transfer dispatch/receipt, and stock ledger behavior are not implemented;
- purchase orders and transfers store only an item count, not line items;
- job parts requests have no inventory approval/fulfilment workflow;
- low-stock notifications are generated, but the related setting is not honored.

### Billing Staff

Expected workflow:

- review approved estimates and completed jobs;
- create invoices from authoritative job/estimate data;
- apply tax rules;
- send invoices;
- record payments;
- track overdue balances;
- report revenue.

Current state:

- invoice list/create and summary backend exist;
- billing UI lists and creates invoices;
- invoices are not relationally linked to jobs or customers;
- amount, tax, total, customer, and job reference can be entered independently;
- no payment, receipt, credit note, reminder, or accounting integration exists;
- PDF download is simulated with a toast;
- reports are mock data and export is simulated.

### Customer

Expected workflow:

- see only the customer’s own equipment, requests, estimates, and service history;
- create a service request;
- approve, reject, or request estimate revision;
- view/download inspection, service, and invoice documents;
- track request progress and communicate with the service team.

Current state:

- a customer role and customer portal routes exist;
- all portal business data comes from `frontend/src/data/mock.ts`;
- approve/reject/revision changes only React state and is lost on refresh;
- there are no customer-scoped backend endpoints;
- the customer cannot create a service request;
- report download is simulated;
- customer identity uses a user `customerId`, but customer APIs do not enforce it.

## 5. Intended end-to-end workflow

The canonical service workflow should be:

`new → inspection → estimate → approval → in-progress → completed → invoiced`

### Stage 1: Request intake

Owner: coordinator or authorized customer.

Required outcome:

- validated customer and one or more customer-owned equipment records;
- request reference;
- type, priority, description, branch, creator, assignee, and SLA;
- timeline event and targeted notification.

Implemented:

- staff request creation;
- generated reference;
- multiple selected equipment records;
- default seven-day SLA;
- timeline creation;
- staff assignment and tenant-wide notification.

Gaps:

- equipment that does not exist is silently skipped;
- ownership of each equipment item is not checked against the selected customer;
- `assignedTo` is required by the frontend/backend input type, preventing a normal unassigned queue;
- request creation, equipment rows, timeline, notification, and customer counter are not one transaction;
- customer self-service intake is missing.

### Stage 2: Inspection

Owner: assigned inspector.

Required outcome:

- findings, measurements/checklist, severity, recommendation, media, author, and timestamps;
- immutable submission/revision trail;
- request moves to estimation.

Implemented:

- one upserted report per request;
- findings, recommendation, severity, reporter, and timeline;
- automatic move to `estimate`.

Gaps:

- no checklist, measurements, attachments, media, signature, or report version history;
- no rule requiring the request to be in the inspection stage;
- no assignment check in inspection service;
- camera/video incomplete.

### Stage 3: Estimate

Owner: estimator/coordinator.

Required outcome:

- itemized labor, parts, quantity, price, tax/discount, validity, terms, and revision;
- sent status and customer notification;
- customer decision with actor, note, and timestamp.

Implemented:

- total from labor plus parts;
- statuses: draft, sent, approved, rejected, revision;
- notification when an estimate is changed to approved.

Gaps:

- no line items, tax, discount, terms, attachments, or linkage by service-request ID;
- estimate stores copied request/customer/equipment names and request reference only;
- no customer decision endpoint;
- no allowed-transition enforcement;
- creation can immediately set any accepted status;
- approval and request advancement are not transactional.

### Stage 4: Job scheduling and execution

Owner: coordinator and assigned engineer.

Required outcome:

- job linked to the approved request/estimate;
- assigned engineer and schedule;
- work log, evidence, parts, signature, completion checklist, and report;
- request/job states remain synchronized.

Implemented:

- generated job reference;
- engineer/coordinator assignment;
- job status and progress;
- job activities;
- image upload as data URLs;
- parts request;
- customer-name sign-off;
- stock deduction.

Gaps:

- job stores request reference rather than a foreign key;
- a job can be created without an approved estimate;
- duplicate jobs can be created for one request;
- request status synchronization is partial;
- completing a job does not reliably complete its request or update equipment service information;
- no actual service report/PDF;
- no object storage, file scanning, size strategy, or retention policy for photos;
- parts request lifecycle is missing.
- the specified additional-parts flow is missing: product/quantity/reason, estimator review, supplementary estimate, customer approval, engineer notification, and reservation.

### Stage 5: Inventory and procurement

Owner: inventory staff.

Required outcome:

- reservation against approved work;
- stock ledger;
- branch-aware transfers;
- purchase-order line items and receipts;
- atomic quantity changes and complete auditability.

Implemented:

- inventory quantity/reserved fields;
- manual CRUD;
- supplier, PO, transfer records;
- direct job stock deduction.

Gaps:

- auto-reserve setting has no operational code;
- no reservation service;
- no stock movement/ledger model;
- no PO or transfer line items;
- receiving a PO does not update inventory;
- receiving a transfer does not move inventory;
- branch references are strings/IDs without complete relational enforcement;
- concurrent deductions can oversell stock.

### Stage 6: Completion and billing

Owner: engineer, coordinator, and billing staff.

Required outcome:

- signed service report;
- equipment service date/condition update;
- completed request and job;
- invoice generated from approved/completed records;
- payment and overdue lifecycle.

Implemented:

- job can be marked completed;
- invoice CRUD and statuses exist.

Gaps:

- report generation is simulated;
- no invoice line items or immutable financial calculation;
- no payment records;
- no automated request transition to `invoiced`;
- no reliable relationship among invoice, job, estimate, request, customer, and equipment.

## 6. Module completion inventory

### Authentication and session — partial

Implemented:

- login, logout, current-user endpoint;
- bcrypt password verification;
- HTTP-only cookie and Bearer-token support;
- staff/customer routing.

Missing or risky:

- password reset/change, account lockout, rate limiting, MFA, session revocation, refresh strategy, and login audit;
- active-user status should be rechecked on authenticated requests, not only at login;
- the current login service does not reject inactive users;
- login finds a username/email globally rather than requiring an explicit tenant, creating ambiguity when different tenants use the same identity;
- default production-like credentials are hardcoded and prefilled in the browser;
- security headers and CSRF protection are not evident.

### Tenant isolation — partial

Implemented:

- tenant ID in JWT;
- tenant filters in most repositories;
- tenant-scoped unique keys.

Missing or risky:

- no tenant provisioning/onboarding workflow;
- some child-record queries depend only on IDs after a parent check;
- direct Prisma updates use only the record ID;
- no automated cross-tenant isolation tests;
- tenant is effectively selected by username/email search at login, so duplicate identities across tenants need a documented login policy.

### RBAC — high-risk partial

Implemented:

- frontend navigation matrix;
- page guards on many modules;
- backend `requireRole` middleware;
- admin-editable RBAC settings.

Missing or risky:

- the editable matrix controls frontend navigation only;
- the backend does not enforce that matrix;
- numerous CRUD routes have authentication but no role authorization;
- some frontend pages, including customers, equipment, service requests, dashboard, notifications, and QR tracking, lack page-level `RoleGuard`;
- hiding navigation is not security because users can call URLs/APIs directly.

### Customers and equipment — partial

Implemented:

- create/list and backend CRUD;
- branch/customer filters;
- asset tags and equipment lookup endpoint.

Missing:

- most edit/delete actions are absent from the frontend;
- customer/equipment counters can drift;
- QR generation, camera scanning, labels, attachments, warranties, maintenance schedules, and real service history;
- customer ownership enforcement.

### Requests and inspections — partial

Implemented:

- operational staff flow, assignment, timeline, inspection persistence, and forward workflow.

Missing:

- controlled transition permissions by role/stage;
- rollback/cancellation/reopen flows;
- transactional state changes;
- files, checklist, communication, escalation, SLA reminders, and customer intake.

### Estimates — partial

Implemented:

- list/create/update/delete API and create UI.

Missing:

- itemization, revision records, customer endpoint, PDF/email, terms, taxes, status permissions, edit/delete UI, and full relational links.

### Jobs — partial

Implemented:

- scheduling, assigned-engineer filtering, actions, progress, activity, and stock use.

Missing:

- strict scheduling eligibility, pause/resume rules, real signature canvas, service report, offline field mode, geolocation/time entries, edit/delete UI, and reliable cross-module completion.

### Inventory, suppliers, purchase orders, transfers — partial

Implemented:

- list/create APIs and screens, plus broad backend CRUD.

Missing:

- line items, receiving, reservation, approval, transfer stock movement, supplier/part links, serial/batch/expiry tracking, stock ledger, valuation, and frontend update/delete coverage.

### AMC — partial

Implemented:

- AMC CRUD records, statuses, dashboard counts, and expiring notifications.

Missing:

- customer/equipment relations, covered equipment list, visit schedule, entitlements, renewal workflow, invoices, automatic status calculation, document generation, and frontend update/delete.

### Billing — partial

Implemented:

- invoice list/create/update/delete API and summary.

Missing:

- payment and receipt models, line items, PDF/email, immutable totals, currency/tax policy, refund/credit note, reminders, accounting export, and frontend update/delete.

### Notifications — partial

Implemented:

- tenant-wide list/read/read-all;
- low-stock and AMC alert synchronization;
- estimate/job/assignment notifications.

Missing or incorrect:

- notifications have no recipient user, role, customer, channel, or delivery status;
- one user marking a notification read marks it read for the whole tenant;
- unread count does not synchronize operational alerts before counting;
- settings such as low-stock and AMC reminders do not control generation;
- assignment notifications are visible tenant-wide rather than only to the assignee.

### Audit logs — incomplete and security-sensitive

Implemented:

- list/create API and admin-looking UI;
- seed data demonstrates intended audit entries.

Missing or incorrect:

- normal business operations do not automatically write audit entries;
- any authenticated user can read and create audit logs through the backend;
- clients can provide arbitrary action/entity values;
- logs are not immutable/protected and are not a reliable compliance trail;
- export is simulated.

### Dashboard — partial

Implemented:

- backend aggregate counts, revenue trend, active jobs, activity, and low stock.

Missing:

- role-specific data minimization;
- verified financial/reporting definitions;
- date ranges and configurable KPIs;
- customer dashboard uses mock data.

### Reports and exports — simulated

- Charts use mock data.
- Standard reports have no backend.
- CSV/PDF/report buttons only show success toasts.
- No export file, background job, storage, or authorization exists.

### QR tracking — simulated

- Manual lookup searches mock equipment and defaults to the first equipment when a tag is not found.
- Camera scanning is visual only.
- Service history is hardcoded.
- A backend asset-tag lookup exists but is not used by this page.
- QR generation, printable labels, and scan audit history are missing.

### Settings — persistence exists, automation incomplete

- Company/support/tax/RBAC settings can be saved.
- `amcRenewalReminders`, `lowStockAlerts`, `autoReserveOnApproval`, and `autoGenerateReport` are stored but not used by the corresponding business services.
- Changing frontend RBAC settings does not secure backend routes.

## 6A. Original specification requirements not yet represented completely

The following requirements are explicitly described in the 51-page SaaS specification but are absent or materially incomplete in the current domain model and user interface:

- service-request address/contact snapshot, general attachments, documents, images, and notes;
- configurable inspection checklists, machine condition, error codes, physical inspection, functional testing, calibration status, technician remarks, media, and inspection PDF;
- estimate line items with part number, quantity, unit price, labor hours/rate, transport, testing, calibration, tax, discount, terms, warranty, notes, PDF, email, and customer delivery;
- estimate rejection/revision feedback, estimator notifications, and immutable revision history;
- engineer work instructions, approved-parts view, started/waiting/testing timestamps, work performed, testing/calibration results, engineer signature, and final machine condition;
- supplementary estimate approval for additional parts;
- automatic reservation on approval, release of unused reservation, deduction on completion, stock adjustments with reasons, and an inventory movement ledger;
- invoice line items, partial payments, payment recording, receipt, print/email/PDF, tax reporting, and overdue processing;
- complete machine history covering repairs, inspections, calibrations, part replacements, warranty, reports, and invoices;
- customer access to inspection reports, estimates, final reports, invoices, documents, active request details, and profile;
- role-specific dashboards, calendars, workload/availability, overdue tasks, pending actions, tax/revenue summaries, and offline synchronization state;
- forgot password, remember-me, user profile, contact update, change password, and tenant registration/onboarding;
- admin master data for machine brands/models, checklists, email templates, notification settings, branding, and report templates;
- accessibility/WCAG verification, offline technician workflows, global search, server-side pagination/sorting, API versioning, and comprehensive filtering.

Future enhancements in the specification—native mobile apps, IoT, predictive analytics, AI diagnosis, chat, video support, accounting/payment integrations, and augmented reality—remain future scope and should not block the core production release.

## 7. Confirmed mistakes and technical risks

### Critical

1. Backend authorization is incomplete. Most authenticated roles can call sensitive customer, equipment, estimate, inventory, supplier, PO, transfer, AMC, invoice, audit, and job mutation endpoints.
2. Customer portal decisions and data are mock-only. It must not be treated as a real customer workflow.
3. Audit logs are client-creatable and not automatically generated, so they are not trustworthy.
4. Notifications are tenant-global and read state is shared among all users.
5. Multi-step operations are usually not transactional, allowing partial records and inconsistent counters/statuses.
6. Stock deduction reads then writes inventory outside one transaction and can race under concurrent requests.
7. A customer JWT can call many staff APIs because most backend routes only require authentication.
8. Inactive users can still authenticate, and login identity is not explicitly tenant-scoped.

### High

1. Current database provider is MySQL, while documentation and environment examples say PostgreSQL. One database must be selected and every file aligned.
2. There are no committed Prisma migrations.
3. Service requests, estimates, jobs, AMC contracts, purchase orders, transfers, and invoices rely heavily on copied names/references instead of foreign keys.
4. Workflow stages can be skipped because advancement allows any later status rather than the next valid status.
5. Role-specific transition rules are missing; any authenticated user can call the workflow endpoint.
6. Jobs can be scheduled before approval and duplicate jobs are possible.
7. Customer/equipment ownership is not consistently validated.
8. Hardcoded default admin credentials are exposed in source and prefilled in the login form.
9. Photos/signatures stored as large base64 database fields create database, backup, and request-size risks.
10. General service-request updates can set status directly and bypass the workflow endpoint.
11. Job activity access does not pass actor identity into the job access check.
12. Reference generation based on record count is unsafe under deletion and concurrent creation.

### Medium

1. The frontend production bundle is about 1.09 MB minified and triggers Vite’s chunk-size warning.
2. Frontend lint reports eight warnings, including a missing `useEffect` dependency in `Jobs.tsx`.
3. The automated frontend test command fails because `frontend/src/test/setup.ts` is configured but missing.
4. The only test file is a placeholder truth assertion; the backend has no tests.
5. Several UI actions report success without performing the operation.
6. Many backend update/delete capabilities do not have matching frontend actions.
7. Operational settings are stored but ignored.
8. Request customer `activeJobs` is incremented on request creation, not actual job creation, and is decremented only on request deletion. It can become inaccurate or negative.
9. No pagination is implemented for most large lists.
10. Search/filter behavior is mostly client-side and will not scale.
11. The Topbar global-search input has no behavior.
12. The service-request Kanban omits the `invoiced` column even though the status exists.
13. Dashboard assignment/job lists are not consistently filtered to the current staff user.
14. React Query is installed and globally configured but its query/mutation hooks are not used.

### Code/data quality

1. Database/schema documentation is stale.
2. The frontend and backend duplicate RBAC definitions, which can drift.
3. Several status and role values use strings/casts instead of shared domain contracts.
4. There is a whitespace error in the current uncommitted `estimates.schema.ts` diff.
5. No API/OpenAPI documentation, deployment guide, backup guide, or production runbook exists.

## 8. Required production-completion plan

### Phase 0: Freeze the domain contract

- choose MySQL or PostgreSQL and align Prisma, `.env.example`, package description, and deployment;
- add and commit the initial migration;
- define state machines for request, estimate, job, PO, transfer, AMC, invoice, and payment;
- define authoritative relationships and replace copied references with foreign keys where required;
- document tenant, branch, customer, and assignee ownership rules.

Exit criteria:

- clean database can be created only from committed migration and seed commands;
- domain statuses and allowed transitions are documented and tested.

### Phase 1: Security and authorization

- implement backend permission middleware using the persisted RBAC matrix or a fixed permission model;
- authorize every read/write action, not only modules;
- enforce assignment/customer scope on detail endpoints;
- make audit logging server-side and automatic;
- add rate limiting, security headers, CSRF strategy, password change/reset, and login audit;
- remove hardcoded/prefilled credentials and rotate all known secrets.

Exit criteria:

- API authorization tests exist for all eight roles;
- direct API calls cannot bypass the UI;
- cross-tenant and cross-customer tests pass.

### Phase 2: Reliable core workflow

- validate customer-equipment ownership;
- make request creation transactional;
- enforce next-stage and role-based transitions;
- connect inspections, estimates, approvals, jobs, completion, and invoices with foreign keys;
- add cancellation, rejection, revision, reopen, and rollback rules;
- synchronize request/job/equipment/customer counters and statuses transactionally.

Exit criteria:

- one automated end-to-end test completes the full request-to-invoice lifecycle;
- invalid role/status transitions return deterministic errors.

### Phase 3: Complete customer portal

- add customer-scoped backend routes;
- replace all portal mock imports;
- support request creation and attachments;
- persist estimate decisions with notes and timestamps;
- expose only the customer’s equipment, history, estimates, invoices, and documents;
- add portal notifications.

Exit criteria:

- browser refresh retains every customer action;
- one customer can never access another customer’s records.

### Phase 4: Field service and documents

- use object storage for media with metadata, size/type validation, malware strategy, and signed access;
- implement inspection checklist and media;
- implement real signature capture;
- generate versioned inspection, estimate, service, and invoice PDFs;
- record report generation and downloads in audit logs.

Exit criteria:

- generated documents contain authoritative persisted data;
- media and documents are access-controlled and testable.

### Phase 5: Inventory and procurement

- add part, PO-line, transfer-line, reservation, receipt, and stock-ledger models;
- implement approval/fulfilment for job parts requests;
- implement atomic reservations and deductions;
- receive POs and transfers into the correct branch;
- honor low-stock and auto-reservation settings.

Exit criteria:

- every stock change has a ledger entry;
- concurrent deduction tests cannot produce negative stock.

### Phase 6: Billing, reporting, and notifications

- derive invoices from approved estimate/completed job line items;
- add payments, receipts, due balances, credit notes, reminders, and reconciliation;
- replace report mocks with server queries and real CSV/PDF exports;
- add per-user notification recipients, preferences, channels, and delivery/read states;
- honor all tenant automation settings.

Exit criteria:

- invoice totals are server-calculated and immutable after issue;
- reports reconcile with source transactions;
- reading one user’s notification does not affect another user.

### Phase 7: Quality, deployment, and operations

- add backend unit/integration tests and frontend component/E2E tests;
- restore the missing Vitest setup;
- fix lint warnings and bundle splitting;
- add API documentation, environment/setup README, CI, health/readiness checks, structured logs, monitoring, backups, restore testing, and deployment instructions;
- define retention and privacy controls for medical-equipment customer data, media, signatures, and audit logs.

Exit criteria:

- builds, lint, unit, integration, and E2E tests pass in CI;
- staging deployment and database restore are documented and verified.

## 9. Current verification results

Executed during this audit:

- backend TypeScript build: passed;
- frontend TypeScript/Vite production build: passed;
- Prisma schema validation with the current local environment: passed;
- frontend lint: passed with eight warnings;
- frontend tests: failed before collecting tests because `frontend/src/test/setup.ts` does not exist;
- backend tests: no test command or test files;
- frontend bundle warning: main JavaScript chunk is approximately 1.09 MB minified;
- Git diff check: one trailing blank-line error in the current uncommitted estimate schema file.

These results prove that the application compiles. They do not prove that the business workflows, security, database migrations, or customer portal are production-ready.

## 10. Definition of complete

MESMS should be marked complete only when all of the following are true:

- no production page depends on mock business data;
- every role has tested frontend and backend permissions;
- every API operation enforces tenant, branch, customer, assignment, and state rules;
- the complete request-to-payment workflow persists and survives refresh/restart;
- all document/download buttons produce real files;
- inspection media and signatures are real, secured, and traceable;
- stock movements are relational, atomic, and auditable;
- invoices and reports derive from authoritative records;
- notifications are recipient-specific;
- audit logs are automatic and tamper-resistant;
- database migrations can create a clean environment;
- CI passes builds, lint, unit, integration, authorization, and E2E tests;
- deployment, backup, restore, monitoring, and security procedures are documented.

## 11. Recommended immediate next actions

1. Resolve the MySQL/PostgreSQL decision and create the initial migration.
2. Add backend authorization to every route and test each role.
3. Replace the mock customer portal with customer-scoped APIs.
4. Enforce a transactional, role-based service workflow.
5. add relational estimate/job/invoice and inventory line-item models.
6. implement automatic audit events and per-user notifications.
7. restore the test setup and build an end-to-end request-to-invoice test.
8. implement real PDF/export, QR, media, and signature behavior only after the domain and security foundations are complete.

