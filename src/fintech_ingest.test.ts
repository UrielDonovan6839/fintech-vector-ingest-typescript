import { strict as assert } from "node:assert";
import { notificationDecision } from "./fintech_ingest";

const base = { paymentId: "p1", accountId: "a1", text: "A valid payment narrative with enough detail.", currency: "USD" };
assert.equal(notificationDecision({ ...base, amount: 12500 }), "review");
assert.equal(notificationDecision({ ...base, amount: 99 }), "record");
console.log("notification decision test passed");
