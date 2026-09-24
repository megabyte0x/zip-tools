import { test } from "node:test";
import assert from "node:assert/strict";
import { draftShortId, zipIdentityLabel, zipIdentityParts } from "./zipIdentity.ts";
import { makeZip } from "./test-zip.ts";

test("draftShortId strips one draft- prefix only", () => {
  assert.equal(draftShortId("draft-arya-deploy-nu7"), "arya-deploy-nu7");
  assert.equal(draftShortId("draft-draft-x"), "draft-x");
  assert.equal(draftShortId("orchard-balance"), "orchard-balance");
  assert.equal(draftShortId("draft-"), "draft-");
});

test("zipIdentityParts distinguishes numbered and draft records", () => {
  assert.deepEqual(zipIdentityParts(makeZip({ number: 318, slug: "zip-0318" })), { prefix: "ZIP", id: "318" });
  assert.deepEqual(
    zipIdentityParts(makeZip({ number: null, slug: "draft-ecc-onchain-accountable-voting" })),
    { prefix: "Draft", id: "ecc-onchain-accountable-voting" },
  );
});

test("zipIdentityLabel gives each draft a unique label", () => {
  const drafts = ["draft-arya-deploy-nu7", "draft-arya-jvff-p2p-quic-transport", "draft-str4d-orchard-balance-proof"]
    .map((slug) => makeZip({ id: slug, number: null, slug }));
  const labels = drafts.map(zipIdentityLabel);
  assert.equal(new Set(labels).size, labels.length);
  assert.equal(labels[0], "Draft arya-deploy-nu7");
  assert.equal(zipIdentityLabel(makeZip({ number: 318 })), "ZIP 318");
});
