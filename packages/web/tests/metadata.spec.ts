import { expect, test } from "@playwright/test";

const titles: Array<[string, string]> = [
  ["/", "ZIP.tools"],
  ["/zip/318", "ZIP 318: Orchard to Ironwood Migration · ZIP.tools"],
  [
    "/draft/draft-arya-dairaemma-disable-addition-of-transparent-chain-value",
    "Draft arya-dairaemma-disable-addition-of-transparent-chain-value: Disabling Addition of New Value to the Transparent Chain Value Pool · ZIP.tools",
  ],
  ["/zips", "Browse ZIPs · ZIP.tools"],
  ["/zips?kind=draft", "Draft ZIPs · ZIP.tools"],
  ["/graph", "Citation graph · ZIP.tools"],
  ["/list", "Reading list · ZIP.tools"],
  ["/zip/999999", "ZIP not found · ZIP.tools"],
];

for (const [path, title] of titles) {
  test(`tab title for ${path}`, async ({ page }) => {
    await page.goto(path);
    await expect(page).toHaveTitle(title);
  });
}

test("every primary route has a distinct title", async ({ page }) => {
  const seen = new Set<string>();
  for (const [path] of titles) {
    await page.goto(path);
    seen.add(await page.title());
  }
  expect(seen.size).toBe(titles.length);
});

test("link-preview crawlers get Open Graph tags in the head", async ({ request }) => {
  const res = await request.get("/zip/318", { headers: { "user-agent": "Twitterbot/1.0" } });
  expect(res.status()).toBe(200);
  const html = await res.text();
  const head = html.slice(0, html.indexOf("</head>"));
  expect(head).toContain("<title>ZIP 318: Orchard to Ironwood Migration · ZIP.tools</title>");
  expect(head).toMatch(/<meta property="og:title" content="ZIP 318: Orchard to Ironwood Migration"\/>/);
  expect(head).toMatch(/<meta property="og:site_name" content="ZIP.tools"\/>/);
  expect(head).toMatch(/<meta name="description" content="[^"]*ZIP[^"]*"\/>/);
});

test("titles with HTML-significant characters are escaped", async ({ page }) => {
  await page.goto("/zips?q=Transaction%20Identifier%20Digests");
  const href = await page.getByRole("link", { name: /Transaction Identifier Digests & Signature/ }).first().getAttribute("href");
  await page.goto(href!);
  await expect(page).toHaveTitle(/Transaction Identifier Digests & Signature Validation/);
});
