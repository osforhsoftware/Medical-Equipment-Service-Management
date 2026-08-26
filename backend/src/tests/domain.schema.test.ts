import assert from "node:assert/strict";
import test from "node:test";
import {
  createPurchaseReturnSchema,
  estimateDecisionSchema,
  estimateRevisionSchema,
  inspectionRecommendationSchema,
  invoiceFromJobSchema,
  paymentSchema,
  receivePurchaseOrderSchema,
  reservationActionSchema,
} from "@/schemas/domain.schema";

test("estimate revision rejects empty line items", () => {
  const result = estimateRevisionSchema.safeParse({ body: { lines: [], discount: 0 } });
  assert.equal(result.success, false);
});

test("estimate decision accepts only controlled transitions", () => {
  assert.equal(estimateDecisionSchema.safeParse({ body: { decision: "approved" } }).success, true);
  assert.equal(estimateDecisionSchema.safeParse({ body: { decision: "draft" } }).success, false);
});

test("reservation quantities must be positive integers", () => {
  assert.equal(reservationActionSchema.safeParse({ body: { action: "consume", quantity: 2 } }).success, true);
  assert.equal(reservationActionSchema.safeParse({ body: { action: "release", quantity: 0 } }).success, false);
  assert.equal(reservationActionSchema.safeParse({ body: { action: "consume", quantity: 1.5 } }).success, false);
});

test("payments reject zero and negative values", () => {
  assert.equal(paymentSchema.safeParse({ body: { amount: 10, method: "card" } }).success, true);
  assert.equal(paymentSchema.safeParse({ body: { amount: 0, method: "card" } }).success, false);
});

test("inspection recommendations support linked parts and services", () => {
  const result = inspectionRecommendationSchema.safeParse({
    body: {
      type: "part",
      title: "Replace oxygen sensor",
      description: "Sensor failed functional testing.",
      priority: "high",
      quantity: 2,
      estimatedCost: 1250,
    },
  });
  assert.equal(result.success, true);
  assert.equal(
    inspectionRecommendationSchema.safeParse({
      body: { title: "", description: "", quantity: 0, estimatedCost: -1 },
    }).success,
    false,
  );
});

test("purchase receipts cannot post empty or non-positive lines", () => {
  assert.equal(
    receivePurchaseOrderSchema.safeParse({
      body: { reference: "GRN-001", lines: [] },
    }).success,
    false,
  );
  assert.equal(
    receivePurchaseOrderSchema.safeParse({
      body: {
        reference: "GRN-001",
        lines: [{ purchaseOrderLineId: "invalid", quantity: 0 }],
      },
    }).success,
    false,
  );
});

test("purchase returns require a purchase order, reason, and positive lines", () => {
  const validCuid = "clw7z0x9p0000abcde1234567";
  assert.equal(
    createPurchaseReturnSchema.safeParse({
      body: {
        purchaseOrderId: validCuid,
        reason: "damaged",
        lines: [{ purchaseOrderLineId: validCuid, quantity: 1 }],
      },
    }).success,
    true,
  );
  assert.equal(
    createPurchaseReturnSchema.safeParse({
      body: { purchaseOrderId: validCuid, reason: "unknown", lines: [{ purchaseOrderLineId: validCuid, quantity: 1 }] },
    }).success,
    false,
  );
  assert.equal(
    createPurchaseReturnSchema.safeParse({
      body: { purchaseOrderId: validCuid, reason: "excess", lines: [] },
    }).success,
    false,
  );
});

test("invoice generation requires a job, due date, and supported currency", () => {
  const validCuid = "clw7z0x9p0000abcde1234567";
  assert.equal(
    invoiceFromJobSchema.safeParse({
      body: { jobId: validCuid, dueAt: "2026-08-01", currency: "INR" },
    }).success,
    true,
  );
  assert.equal(
    invoiceFromJobSchema.safeParse({
      body: { jobId: validCuid, dueAt: "2026-08-01", currency: "RUPEE" },
    }).success,
    false,
  );
});
