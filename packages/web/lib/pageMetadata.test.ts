import { test } from "node:test";
import assert from "node:assert/strict";
import {
  SITE_DESCRIPTION, SITE_NAME, pageMetadata, rootMetadata, zipPageDescription, zipPageTitle,
} from "./pageMetadata.ts";
import { makeZip } from "./test-zip.ts";

test("root metadata uses a title template so child routes are distinct", () => {
  const meta = rootMetadata();
  assert.deepEqual(meta.title, { default: "zips.tools — Zcash Improvement Proposals", template: "%s · zips.tools" });
  assert.equal(meta.description, SITE_DESCRIPTION);
  assert.equal((meta.openGraph as { siteName?: string }).siteName, SITE_NAME);
  assert.ok(meta.metadataBase instanceof URL);
  assert.equal(meta.metadataBase.origin, "https://zips.tools");
  assert.deepEqual(meta.openGraph?.images, [{ url: "/og/site.png", width: 1200, height: 630, alt: "zips.tools — Zcash Improvement Proposals" }]);
  assert.deepEqual(meta.twitter, {
    card: "summary_large_image", title: SITE_NAME, description: SITE_DESCRIPTION,
    images: [{ url: "/og/site.png", width: 1200, height: 630, alt: "zips.tools — Zcash Improvement Proposals" }],
  });
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
    "Draft Consensus ZIP by Daira-Emma Hopwood, Jack Grigg. Read the full text and citation graph on zips.tools.",
  );
  const long = zipPageDescription(makeZip({ owners: Array.from({ length: 30 }, (_, i) => ({ name: `Owner Number ${i}` })) }));
  assert.ok(long.length <= 200);
  assert.ok(long.endsWith("…"));
});

test("zipPageDescription tolerates missing category and owners", () => {
  assert.equal(
    zipPageDescription(makeZip({ status: [], statusRaw: "Reserved", category: null, owners: [] })),
    "Reserved ZIP. Read the full text and citation graph on zips.tools.",
  );
});

test("zipPageDescription leads with the proposal's abstract when it has one", () => {
  const html = makeZip({
    status: [{ label: "Final" }], statusRaw: "Final", category: "Wallet", bodyFormat: "html",
    body: '<h1 id="motivation">Motivation</h1><p>Not this.</p><h1 id="abstract">Abstract</h1>\n<p>Extends BIP 32 <a href="#fn4" class="footnote-ref" id="fnref4" role="doc-noteref"><sup>4</sup></a> to Zcash&#39;s <em>shielded</em> addresses &amp; keys.</p><p>Second paragraph.</p>',
  });
  assert.equal(zipPageDescription(html), "Final Wallet ZIP: Extends BIP 32 to Zcash's shielded addresses & keys.");

  const markdown = makeZip({
    status: [{ label: "Draft" }], statusRaw: "Draft", category: "Consensus", bodyFormat: "markdown",
    body: "# Abstract\n\nDefines version 6 of the *transaction format*, activated at\nNU6.3 [^zip-0258] per [ZIP 200](https://zips.z.cash/zip-0200).\n\n# Motivation\n\nLater text.",
  });
  assert.equal(zipPageDescription(markdown), "Draft Consensus ZIP: Defines version 6 of the transaction format, activated at NU6.3 per ZIP 200.");

  const long = zipPageDescription(makeZip({ bodyFormat: "markdown", body: `# Abstract\n\n${"word ".repeat(80)}` }));
  assert.ok(long.length <= 200);
  assert.match(long, /word…$/);
});

test("zipPageDescription keeps out-of-range numeric entities as text", () => {
  const zip = makeZip({ status: [], statusRaw: "Draft", category: null, bodyFormat: "html", body: '<h1 id="abstract">Abstract</h1><p>Bad &#x110000; and &#99999999; codes.</p>' });
  assert.equal(zipPageDescription(zip), "Draft ZIP: Bad &#x110000; and &#99999999; codes.");
});

test("zipPageDescription ignores an Abstract heading with no paragraph after it", () => {
  const zip = makeZip({ status: [], statusRaw: "Reserved", category: null, owners: [], bodyFormat: "markdown", body: "# Abstract\n\n## Details\n\nText." });
  assert.equal(zipPageDescription(zip), "Reserved ZIP. Read the full text and citation graph on zips.tools.");
});

test("pageMetadata mirrors title and description into Open Graph and Twitter", () => {
  const meta = pageMetadata({ title: "ZIP 318: Orchard to Ironwood Migration", description: "D" });
  assert.equal(meta.title, "ZIP 318: Orchard to Ironwood Migration");
  assert.deepEqual({ ...(meta.openGraph as object), url: undefined, images: undefined }, {
    url: undefined, images: undefined, siteName: "zips.tools", type: "article", title: "ZIP 318: Orchard to Ironwood Migration", description: "D",
  });
  assert.deepEqual(meta.twitter, { card: "summary_large_image", title: "ZIP 318: Orchard to Ironwood Migration", description: "D", images: ["/og/site.png"] });
  const proposal = pageMetadata({ title: "ZIP 318", description: "D", path: "/zip/318", image: "/og/318.png" });
  assert.deepEqual(proposal.openGraph?.images, [{ url: "/og/318.png", width: 1200, height: 630, alt: "ZIP 318" }]);
  assert.deepEqual(proposal.twitter, { card: "summary_large_image", title: "ZIP 318", description: "D", images: ["/og/318.png"] });
});
