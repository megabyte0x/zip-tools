import { test } from "node:test";
import assert from "node:assert/strict";
import {
  SITE_DESCRIPTION, SITE_NAME, pageMetadata, rootMetadata, zipPageDescription, zipPageTitle,
} from "./pageMetadata.ts";
import { makeZip } from "./test-zip.ts";

test("root metadata uses a title template so child routes are distinct", () => {
  const meta = rootMetadata();
  assert.deepEqual(meta.title, { default: "ZIP.tools — Zcash Improvement Proposals", template: "%s · ZIP.tools" });
  assert.equal(meta.description, SITE_DESCRIPTION);
  assert.equal((meta.openGraph as { siteName?: string }).siteName, SITE_NAME);
});

test("zipPageTitle names numbered ZIPs and drafts", () => {
  assert.equal(
    zipPageTitle(makeZip({ number: 318, title: "Orchard to Ironwood Migration" })),
    "ZIP 318: Orchard to Ironwood Migration",
  );
  assert.equal(
    zipPageTitle(makeZip({ number: null, slug: "draft-arya-deploy-nu7", title: "Deployment of the NU7 Network Upgrade" })),
    "Draft arya-deploy-nu7: Deployment of the NU7 Network Upgrade",
  );
});

test("zipPageDescription summarizes metadata and stays within 200 characters", () => {
  const zip = makeZip({
    status: [{ label: "Draft" }], statusRaw: "Draft", category: "Consensus",
    owners: [{ name: "Daira-Emma Hopwood" }, { name: "Jack Grigg" }],
  });
  assert.equal(
    zipPageDescription(zip),
    "Draft Consensus ZIP by Daira-Emma Hopwood, Jack Grigg. Read the full text and citation graph on ZIP.tools.",
  );
  const long = zipPageDescription(makeZip({ owners: Array.from({ length: 30 }, (_, i) => ({ name: `Owner Number ${i}` })) }));
  assert.ok(long.length <= 200);
  assert.ok(long.endsWith("…"));
});

test("zipPageDescription tolerates missing category and owners", () => {
  assert.equal(
    zipPageDescription(makeZip({ status: [], statusRaw: "Reserved", category: null, owners: [] })),
    "Reserved ZIP. Read the full text and citation graph on ZIP.tools.",
  );
});

test("pageMetadata mirrors title and description into Open Graph and Twitter", () => {
  const meta = pageMetadata({ title: "ZIP 318: Orchard to Ironwood Migration", description: "D" });
  assert.equal(meta.title, "ZIP 318: Orchard to Ironwood Migration");
  assert.deepEqual({ ...(meta.openGraph as object), url: undefined, images: undefined }, {
    url: undefined, images: undefined, siteName: "ZIP.tools", type: "article", title: "ZIP 318: Orchard to Ironwood Migration", description: "D",
  });
  assert.deepEqual(meta.twitter, { card: "summary", title: "ZIP 318: Orchard to Ironwood Migration", description: "D" });
});
