import assert from "node:assert/strict";
import test from "node:test";
import {
  assertTicketAdvance,
  assertTicketReopen,
  assertJobTransition,
  TICKET_TRANSITIONS,
  TICKET_STATUS_ORDER,
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
  expectAppError(() => assertTicketAdvance("approval", "new", "admin"), 409);
});

test("ticket advance enforces role gates", () => {
  expectAppError(() => assertTicketAdvance("new", "inspection", "billing"), 403);
  expectAppError(() => assertTicketAdvance("completed", "invoiced", "engineer"), 403);
  assert.doesNotThrow(() => assertTicketAdvance("completed", "invoiced", "billing"));
});

test("every non-terminal status has exactly one forward transition", () => {
  for (const status of TICKET_STATUS_ORDER) {
    if (status === "finished") {
      assert.deepEqual(TICKET_TRANSITIONS[status], []);
    } else {
      assert.equal(TICKET_TRANSITIONS[status].length, 1);
    }
  }
});

test("reopen moves backward and is role-gated", () => {
  assert.doesNotThrow(() => assertTicketReopen("inProgress", "estimate", "admin"));
  expectAppError(() => assertTicketReopen("inProgress", "completed", "admin"), 409);
  expectAppError(() => assertTicketReopen("inProgress", "estimate", "engineer"), 403);
  expectAppError(() => assertTicketReopen("finished", "invoiced", "coordinator"), 403);
  assert.doesNotThrow(() => assertTicketReopen("finished", "invoiced", "admin"));
});

test("job transitions reject illegal jumps", () => {
  assert.doesNotThrow(() => assertJobTransition("scheduled", "inProgress"));
  expectAppError(() => assertJobTransition("scheduled", "completed"), 409);
  expectAppError(() => assertJobTransition("completed", "inProgress"), 409);
});
