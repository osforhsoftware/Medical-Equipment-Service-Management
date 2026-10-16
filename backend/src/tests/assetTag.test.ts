import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ASSET_TAG_SEQUENCE_START,
  claimNextSequence,
  companyNameToAssetTagPrefix,
  formatAssetTag,
  isValidAssetTagPrefix,
  nextSequenceFromExisting,
  normalizeAssetTagPrefix,
  sequenceFromAssetTag,
} from "@/lib/assetTag";

describe("company asset tag prefix", () => {
  it("abbreviates a multi-word company name", () => {
    assert.equal(companyNameToAssetTagPrefix("Medical Facility Diagnostics"), "MED-FD");
    assert.equal(companyNameToAssetTagPrefix("Medi-First Diagnostics"), "MED-FD");
  });

  it("drops legal suffixes and uses a single word when one remains", () => {
    assert.equal(companyNameToAssetTagPrefix("Acme Corporation"), "ACME");
    assert.equal(companyNameToAssetTagPrefix("Siemens"), "SIEMEN");
  });

  it("falls back when the name has no usable words", () => {
    assert.equal(companyNameToAssetTagPrefix("The Company Ltd"), "AST");
  });
});

describe("asset tag prefix validation", () => {
  it("normalizes and accepts a readable prefix", () => {
    assert.equal(normalizeAssetTagPrefix(" med-fd "), "MED-FD");
    assert.equal(isValidAssetTagPrefix("MED-FD"), true);
    assert.equal(isValidAssetTagPrefix("A"), false);
    assert.equal(isValidAssetTagPrefix("MED FD"), false);
    assert.equal(isValidAssetTagPrefix("MED-FD-EXTRA-LONG-PREFIX"), false);
  });
});

describe("asset tag sequence", () => {
  it("starts a new installation at 1001", () => {
    assert.equal(nextSequenceFromExisting("MED-FD", []), ASSET_TAG_SEQUENCE_START);
    assert.equal(formatAssetTag("MED-FD", 1001), "MED-FD-1001");
  });

  it("continues after the highest suffix for that prefix only", () => {
    const next = nextSequenceFromExisting("MED-FD", [
      "MED-FD-1004",
      "MED-FD-1002",
      "EQ-MRI-001",
      "MED-AX-7740",
      "med-fd-1008",
      "MED-FD-EXTRA",
    ]);
    assert.equal(next, 1009);
    assert.equal(sequenceFromAssetTag("MED-FD", "MED-AX-7740"), null);
  });

  it("does not start below 1001 when older suffixes are smaller", () => {
    assert.equal(nextSequenceFromExisting("MED-FD", ["MED-FD-50"]), 1001);
  });

  it("skips a number that is already stored and keeps moving forward", () => {
    const occupied = new Set(["MED-FD-1001", "MED-FD-1002"]);
    const claimed = claimNextSequence(1001, (tag) => occupied.has(tag), "MED-FD");
    assert.equal(claimed.assetTag, "MED-FD-1003");
    assert.equal(claimed.nextSequence, 1004);
  });

  it("does not reuse a deleted tag once the counter has passed it", () => {
    const live = new Set(["MED-FD-1001", "MED-FD-1003"]);
    const counter = 1004;
    live.delete("MED-FD-1002");
    const claimed = claimNextSequence(counter, (tag) => live.has(tag), "MED-FD");
    assert.equal(claimed.assetTag, "MED-FD-1004");
    assert.notEqual(claimed.assetTag, "MED-FD-1002");
  });

  it("issues unique tags when claims are serialized, and rolls back a failed claim", async () => {
    let next = 1001;
    const live = new Set<string>();
    let chain = Promise.resolve();

    const allocate = (commit: boolean) => {
      const run = chain.then(() => {
        const snapshot = next;
        const claimed = claimNextSequence(next, (tag) => live.has(tag), "MED-FD");
        if (!commit) {
          next = snapshot;
          throw new Error("registration failed");
        }
        next = claimed.nextSequence;
        live.add(claimed.assetTag);
        return claimed.assetTag;
      });
      chain = run.then(
        () => undefined,
        () => undefined,
      );
      return run;
    };

    const issued = await Promise.all(Array.from({ length: 25 }, () => allocate(true)));
    assert.equal(new Set(issued).size, 25);
    assert.equal(issued[0], "MED-FD-1001");
    assert.equal(issued[24], "MED-FD-1025");
    assert.equal(next, 1026);

    await assert.rejects(() => allocate(false));
    assert.equal(next, 1026);
    const afterFailure = await allocate(true);
    assert.equal(afterFailure, "MED-FD-1026");
  });

  it("keeps stored tags when the prefix used for new assets changes", () => {
    const stored = ["MED-FD-1001", "EQ-MRI-001"];
    const nextPrefix = companyNameToAssetTagPrefix("Acme Hospital");
    assert.equal(formatAssetTag(nextPrefix, ASSET_TAG_SEQUENCE_START), "ACM-H-1001");
    assert.deepEqual(stored, ["MED-FD-1001", "EQ-MRI-001"]);
  });
});
