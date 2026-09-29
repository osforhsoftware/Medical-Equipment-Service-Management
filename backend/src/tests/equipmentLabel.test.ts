import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { equipmentTicketLabel } from "@/lib/equipmentLabel";

describe("equipment ticket label", () => {
  it("includes the model when one is set", () => {
    assert.equal(equipmentTicketLabel({ name: "TDR", model: "Cobas 8000" }), "TDR (Cobas 8000)");
  });

  it("uses the name alone when the model is blank", () => {
    assert.equal(equipmentTicketLabel({ name: "TDR", model: "  " }), "TDR");
  });
});
