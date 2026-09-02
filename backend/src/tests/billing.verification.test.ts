import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { computeVerificationChecklist } from "@/services/billing.service";

describe("billing verification checklist", () => {
  it("passes when all operational checkpoints are satisfied", () => {
    const result = computeVerificationChecklist({
      status: "completed",
      workLogs: [{ id: "1" }],
      signature: { id: "sig" },
      stockMovements: [{ id: "m1" }],
      reservations: [{ status: "consumed", quantity: 1, consumed: 1, released: 0 }],
      estimate: {
        status: "approved",
        lineItems: [{ type: "part" }, { type: "labour" }],
      },
      serviceRequest: { inspectionReport: { id: "insp" }, status: "completed" },
      serviceReportDoc: true,
    });
    assert.equal(result.allPassed, true);
    assert.equal(result.items.every((i) => i.passed), true);
  });

  it("still passes when optional customer signature is missing", () => {
    const result = computeVerificationChecklist({
      status: "completed",
      workLogs: [{ id: "1" }],
      signature: null,
      stockMovements: [],
      reservations: [],
      estimate: { status: "approved", lineItems: [{ type: "service" }] },
      serviceRequest: { inspectionReport: { id: "insp" }, status: "completed" },
      serviceReportDoc: true,
    });
    assert.equal(result.allPassed, true);
    assert.equal(result.checks.customerSignatureAvailable, false);
  });

  it("skips ticket-only checks for standalone jobs", () => {
    const result = computeVerificationChecklist({
      status: "completed",
      workLogs: [{ id: "1" }],
      signature: null,
      stockMovements: [],
      reservations: [],
      estimate: null,
      serviceRequestId: null,
      serviceRequest: null,
      serviceReportDoc: false,
    });
    assert.equal(result.allPassed, true);
    assert.equal(result.checks.inspectionCompleted, true);
    assert.equal(result.checks.customerApprovalAvailable, true);
  });
});
