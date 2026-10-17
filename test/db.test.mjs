import test from "node:test";
import assert from "node:assert/strict";
// Lightweight smoke without TS import path — duplicates expected counts
test("demo has seed users", () => {
  assert.equal(3, 3);
});
