import assert from "node:assert/strict";
import test from "node:test";
import {
  assertTicketAdvance,
  assertTicketReopen,
  assertJobTransition,
  TICKET_TRANSITIONS,
  TICKET_STATUS_ORDER,
  normalizeTicketStatus,
  resolveTicketEventStatus,
} from "@/services/workflow/serviceTicketStateMachine";
import { shouldSkipApprovals } from "@/lib/userPermissions";
import { AppError } from "@/middleware/errorHandler";

function expectAppError(fn: () => void, status: number) {
  try {
    fn();
    assert.fail("expected AppError");
  } catch (error) {
    assert.ok(error instanceof AppError);
    assert.equal(error.statusCode, status);
  }
}

test("ticket advance allows only the next stage", () => {
  assert.doesNotThrow(() => assertTicketAdvance("new", "inspection", "coordinator"));
  expectAppError(() => assertTicketAdvance("new", "estimate", "admin"), 409);
  expectAppError(() => assertTicketAdvance("pending_approval", "new", "admin"), 409);
});

test("ticket advance enforces role gates", () => {
  expectAppError(() => assertTicketAdvance("new", "inspection", "billing"), 403);
  expectAppError(() => assertTicketAdvance("pending_final_approval", "pending_invoice", "engineer"), 403);
  assert.doesNotThrow(() => assertTicketAdvance("pending_final_approval", "pending_invoice", "admin"));
});

test("legacy statuses normalize for workflow checks", () => {
  assert.equal(normalizeTicketStatus("approval"), "pending_approval");
  assert.equal(normalizeTicketStatus("inProgress"), "assigned_engineer");
  assert.equal(normalizeTicketStatus("finished"), "closed");
});

test("terminal status has no forward transitions", () => {
  assert.deepEqual(TICKET_TRANSITIONS.closed, []);
});

test("assigned_engineer allows change request or completion paths", () => {
  assert.deepEqual(TICKET_TRANSITIONS.assigned_engineer, [
    "change_pending_approval",
    "pending_final_approval",
    "cancelled",
  ]);
});

test("reopen moves backward and is role-gated", () => {
  assert.doesNotThrow(() => assertTicketReopen("assigned_engineer", "estimate", "admin"));
  expectAppError(() => assertTicketReopen("assigned_engineer", "pending_final_approval", "admin"), 409);
  expectAppError(() => assertTicketReopen("assigned_engineer", "estimate", "engineer"), 403);
  expectAppError(() => assertTicketReopen("closed", "invoiced", "coordinator"), 403);
  assert.doesNotThrow(() => assertTicketReopen("closed", "invoiced", "admin"));
});

test("events cannot skip legal ticket transitions", () => {
  expectAppError(() => resolveTicketEventStatus("new", "invoiceGenerated"), 409);
  expectAppError(() => resolveTicketEventStatus("new", "estimateCreated"), 409);
  assert.equal(resolveTicketEventStatus("inspection", "estimateCreated"), "estimate");
  assert.equal(resolveTicketEventStatus("pending_invoice", "invoiceGenerated"), "invoiced");
  assert.equal(resolveTicketEventStatus("estimate", "ticketCancelled"), "cancelled");
  assert.equal(resolveTicketEventStatus("pending_final_approval", "finalApprovalRejected"), "assigned_engineer");
});

test("job can return from complete or delivery to review after final-approval reject", () => {
  assert.doesNotThrow(() => assertJobTransition("completed", "review"));
  assert.doesNotThrow(() => assertJobTransition("delivery", "review"));
  assert.doesNotThrow(() => assertJobTransition("delivery", "inProgress"));
});

test("revision request returns ticket to estimate stage", () => {
  assert.equal(resolveTicketEventStatus("pending_approval", "estimateRevisionRequested"), "estimate");
  assert.equal(resolveTicketEventStatus("approval", "estimateRevisionRequested"), "estimate");
  assert.equal(resolveTicketEventStatus("pending_approval", "estimateRejected"), "estimate");
  // Same-stage pending approval is a no-op (stays on approval); it must not reverse.
  assert.equal(resolveTicketEventStatus("pending_approval", "estimatePendingApproval"), "pending_approval");
});

test("shouldSkipApprovals uses tenant flag or per-user bypass", () => {
  assert.equal(shouldSkipApprovals(true, {}), true);
  assert.equal(shouldSkipApprovals(false, { bypassApprovals: true }), true);
  assert.equal(shouldSkipApprovals(false, { mode: "crud", modules: {}, bypassApprovals: false }), false);
  assert.equal(shouldSkipApprovals(false, {}), true);
});

test("shouldSkipApprovals tenant flag wins over a user without bypass", () => {
  assert.equal(shouldSkipApprovals(true, { bypassApprovals: false }), true);
});

test("skip approvals jumps estimate and job-complete gates", () => {
  assert.equal(
    resolveTicketEventStatus("estimate", "estimatePendingApproval", { skipApprovals: true }),
    "assigned_engineer",
  );
  assert.equal(
    resolveTicketEventStatus("assigned_engineer", "jobCompleted", { skipApprovals: true }),
    "pending_invoice",
  );
  assert.equal(
    resolveTicketEventStatus("assigned_engineer", "changeRequestSubmitted", { skipApprovals: true }),
    "assigned_engineer",
  );
  assert.equal(resolveTicketEventStatus("estimate", "estimatePendingApproval"), "pending_approval");
  assert.equal(resolveTicketEventStatus("assigned_engineer", "jobCompleted"), "pending_final_approval");
});

test("skip approvals does not open arbitrary jumps", () => {
  expectAppError(() => resolveTicketEventStatus("new", "invoiceGenerated", { skipApprovals: true }), 409);
  expectAppError(() => resolveTicketEventStatus("inspection", "jobCompleted", { skipApprovals: true }), 409);
});

test("job transitions require QA then complete before delivery", () => {
  assert.doesNotThrow(() => assertJobTransition("scheduled", "inProgress"));
  assert.doesNotThrow(() => assertJobTransition("inProgress", "review"));
  assert.doesNotThrow(() => assertJobTransition("review", "completed"));
  assert.doesNotThrow(() => assertJobTransition("completed", "delivery"));
  assert.doesNotThrow(() => assertJobTransition("review", "inProgress"));
  expectAppError(() => assertJobTransition("review", "delivery"), 409);
  expectAppError(() => assertJobTransition("scheduled", "completed"), 409);
  expectAppError(() => assertJobTransition("inProgress", "completed"), 409);
  expectAppError(() => assertJobTransition("completed", "inProgress"), 409);
  expectAppError(() => assertJobTransition("delivery", "completed"), 409);
});
