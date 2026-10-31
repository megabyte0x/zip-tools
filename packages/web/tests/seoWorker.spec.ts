import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

const sitemapParts = JSON.parse(readFileSync(new URL("../data/sitemap-parts.json", import.meta.url), "utf8")) as string[];

test("legacy host redirects before serving pages, documents and assets", async ({ request }) => {
  for (const path of ["/zip/32?part=2", "/zip/0032.md?part=2", "/robots.txt", "/sitemap.xml", "/og/site.png"]) {
    const primaryPath = path.replace("/zip/0032", "/zip/32");
    const primary = await request.get(primaryPath, { headers: { host: "zips.tools" }, maxRedirects: 0 });
    expect(primary.status(), primaryPath).toBe(200);
    for (const method of ["GET", "HEAD"] as const) {
      const legacy = await request.fetch(path, { method, headers: { host: "zip-tools-web.harpocrates.workers.dev" }, maxRedirects: 0 });
      expect(legacy.status(), path).toBe(308);
      expect(legacy.headers().location, path).toBe(`https://zips.tools${primaryPath}`);
    }
  }
});

test("sitemap includes every generated part and each is an indexable canonical page", async ({ request }) => {
  test.setTimeout(120_000);
  const sitemap = await request.get("/sitemap.xml");
  expect(sitemap.status()).toBe(200);
  const xml = await sitemap.text();
  expect(sitemapParts.length).toBeGreaterThan(0);
  for (const path of sitemapParts) {
    expect(xml, path).toContain(`${path}</loc>`);
    const page = await request.get(path);
    expect(page.status(), path).toBe(200);
    expect(page.headers()["x-robots-tag"] ?? "", path).not.toContain("noindex");
    const html = await page.text();
    expect(html, path).toContain(`<link rel="canonical" href="https://zips.tools${path}"`);
    expect(html, path).not.toContain('<meta name="robots" content="noindex');
  }
});

test("reader references and discussion placeholder do not point to missing pages", async ({ page }) => {
  await page.goto("/zip/374?part=2");
  await expect(page.getByRole("link", { name: "Orchard to Ironwood Migration (draft)" })).toHaveAttribute("href", "/zip/318");
  await expect(page.getByRole("link", { name: "NU6.3 Consequences for Wallets (draft)" })).toHaveAttribute("href", "/zip/326");

  await page.goto("/zip/318?part=3");
  await expect(page.getByText("NU6.2 and NU6.3 updates to the Orchard Circuit (draft)")).toBeVisible();
  await expect(page.getByRole("link", { name: "NU6.2 and NU6.3 updates to the Orchard Circuit (draft)" })).toHaveCount(0);

  await page.goto("/draft/draft-mcgee-keyholders-organizations");
  await expect(page.getByRole("complementary").getByText("<URL TBD>")).toBeVisible();
  await expect(page.locator('a[href*="URL%20TBD"], a[href="URL TBD"]')).toHaveCount(0);
});

test("proposal pages link to the verified historical sources", async ({ page }) => {
  const citations = [
    ["/zip/315", "ZIP 316: Unified Addresses and Unified Viewing Keys — Deriving a Unified Address from a UIVK", "https://zips.z.cash/zip-0316#deriving-a-unified-address-from-a-uivk"],
    ["/draft/draft-ecc-onchain-accountable-voting", "draft-ecc-zbloc: Zcash Governance Bloc", "https://github.com/zcash/zips/blob/9dd3b2cefcf82ac98426c897fafcf9e4e7726278/zips/draft-ecc-zbloc.md"],
    ["/zip/230", "draft-arya-deploy-nu7: Deployment of the NU7 Network Upgrade", "https://github.com/zcash/zips/blob/a2fbe6c5883ec8ea035eda0decc5850347dec600/zips/draft-arya-deploy-nu7.md"],
    ["/draft/draft-arya-jvff-p2p-quic-transport?part=3", "Draft ZIP: Block Chain Synchronization", "https://github.com/zcash/zips/blob/8c15df4fc23046d13aa430a1af14e86eafd9d089/zips/draft-arya-block-chain-sync.md"],
  ];
  for (const [path, label, href] of citations) {
    const response = await page.goto(path);
    expect(response?.status(), path).toBe(200);
    await expect(page.getByRole("link", { name: label, exact: true })).toHaveAttribute("href", href);
  }
});
