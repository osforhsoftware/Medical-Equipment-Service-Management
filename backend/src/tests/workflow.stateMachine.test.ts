import assert from "node:assert/strict";
import test from "node:test";
import {
  assertTicketAdvance,
  assertTicketReopen,
  assertJobTransition,
  TICKET_TRANSITIONS,
  TICKET_STATUS_ORDER,
  normalizeTicketStatus,
} from "@/services/workflow/serviceTicketStateMachine";
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
  ]);
});

test("reopen moves backward and is role-gated", () => {
  assert.doesNotThrow(() => assertTicketReopen("assigned_engineer", "estimate", "admin"));
  expectAppError(() => assertTicketReopen("assigned_engineer", "pending_final_approval", "admin"), 409);
  expectAppError(() => assertTicketReopen("assigned_engineer", "estimate", "engineer"), 403);
  expectAppError(() => assertTicketReopen("closed", "invoiced", "coordinator"), 403);
  assert.doesNotThrow(() => assertTicketReopen("closed", "invoiced", "admin"));
});

test("job transitions reject illegal jumps", () => {
  assert.doesNotThrow(() => assertJobTransition("scheduled", "inProgress"));
  expectAppError(() => assertJobTransition("scheduled", "completed"), 409);
  expectAppError(() => assertJobTransition("completed", "inProgress"), 409);
});
