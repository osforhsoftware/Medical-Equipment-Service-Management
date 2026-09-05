import assert from "node:assert/strict";
import test from "node:test";
import { formatReference, parseReferenceSequence } from "@/utils/reference";

test("formatReference zero-pads the sequence", () => {
  assert.equal(formatReference("SR", 2026, 1), "SR-2026-0001");
  assert.equal(formatReference("SR", 2026, 7), "SR-2026-0007");
  assert.equal(formatReference("CUST", 2026, 142), "CUST-2026-0142");
});

test("parseReferenceSequence reads the next number from a live reference", () => {
  assert.equal(parseReferenceSequence("SR-2026-0006", "SR", 2026), 6);
  assert.equal(parseReferenceSequence("SR-2026-0142", "SR", 2026), 142);
});

test("parseReferenceSequence ignores other years and prefixes", () => {
  assert.equal(parseReferenceSequence("SR-2025-0006", "SR", 2026), null);
  assert.equal(parseReferenceSequence("DEMO-SR-2026-0006", "SR", 2026), null);
  assert.equal(parseReferenceSequence("SR-2026-abc", "SR", 2026), null);
});

test("next ticket after a seed gap uses the highest number, not the count", () => {
  const last = "SR-2026-0006";
  const next = (parseReferenceSequence(last, "SR", 2026) ?? 0) + 1;
  assert.equal(formatReference("SR", 2026, next), "SR-2026-0007");
});
