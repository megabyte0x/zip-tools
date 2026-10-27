import { expect, test } from "@playwright/test";

const titles: Array<[string, string]> = [
  ["/", "zips.tools — Zcash Improvement Proposals"],
  ["/zip/318", "ZIP 318: Orchard to Ironwood Migration · zips.tools"],
  [
    "/draft/draft-arya-dairaemma-disable-addition-of-transparent-chain-value",
    "Draft arya-dairaemma-disable-addition-of-transparent-chain-value: Disabling Addition of New Value to the Transparent Chain Value Pool · zips.tools",
  ],
  ["/zips", "Browse ZIPs · zips.tools"],
  ["/zips?kind=draft", "Draft ZIPs · zips.tools"],
  ["/graph", "Citation graph · zips.tools"],
  ["/list", "Reading list · zips.tools"],
  ["/zip/999999", "ZIP not found · zips.tools"],
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
  expect(head).toContain("<title>ZIP 318: Orchard to Ironwood Migration · zips.tools</title>");
  expect(head).toMatch(/<meta property="og:title" content="ZIP 318: Orchard to Ironwood Migration"\/>/);
  expect(head).toMatch(/<meta property="og:site_name" content="zips.tools"\/>/);
  expect(head).toMatch(/<meta name="description" content="[^"]*ZIP[^"]*"\/>/);
});

test("social preview images use the public domain and serve full-size PNGs", async ({ request }) => {
  const draft = "draft-arya-dairaemma-disable-addition-of-transparent-chain-value";
  for (const [path, imagePath] of [["/", "/og/site.png"], ["/graph", "/og/site.png"], ["/zip/318", "/og/318.png"], [`/draft/${draft}`, `/og/${draft}.png`]]) {
    const res = await request.get(path, { headers: { "user-agent": "Twitterbot/1.0" } });
    expect(res.status()).toBe(200);
    const html = await res.text();
    const head = html.slice(0, html.indexOf("</head>"));
    expect(head).toContain(`<link rel="canonical" href="https://zips.tools${path === "/" ? "" : path}"`);
    expect(head).toContain(`<meta property="og:image" content="https://zips.tools${imagePath}"`);
    expect(head).toContain(`<meta name="twitter:image" content="https://zips.tools${imagePath}"`);
    expect(head).toMatch(/<meta name="twitter:image:alt" content="[^"]+"/);
    expect(head).toContain(`<meta property="og:type" content="${path.startsWith("/zip/") || path.startsWith("/draft/") ? "article" : "website"}"`);
    expect(head).toContain('<meta name="twitter:card" content="summary_large_image"');
    const image = await request.get(imagePath);
    expect(image.status()).toBe(200);
    expect(image.headers()["content-type"]).toContain("image/png");
    const png = await image.body();
    expect(png.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
    expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([1200, 630]);
  }
});

test("titles with HTML-significant characters are escaped", async ({ page }) => {
  await page.goto("/zips?q=Transaction%20Identifier%20Digests");
  const href = await page.getByRole("link", { name: /Transaction Identifier Digests & Signature/ }).first().getAttribute("href");
  await page.goto(href!);
  await expect(page).toHaveTitle(/Transaction Identifier Digests & Signature Validation/);
});

test("crawlers get noindex only for personal and filtered listings", async ({ request }) => {
  for (const [path, noindex] of [
    ["/list", true], ["/zips?q=wallet&page=2", true], ["/zips?kind=draft&q=wallet", true],
    ["/zips", false], ["/zips?kind=draft", false], ["/zip/32", false],
    ["/draft/draft-arya-dairaemma-disable-addition-of-transparent-chain-value", false],
  ] as const) {
    const response = await request.get(path, { headers: { "user-agent": "Googlebot" } });
    expect(response.status(), path).toBe(200);
    const html = await response.text();
    expect(/<meta name="robots" content="noindex, follow"/.test(html), path).toBe(noindex);
  }
});

test("proposal aliases permanently redirect with the selected part", async ({ request }) => {
  const response = await request.get("/zip/0032?part=2", { maxRedirects: 0 });
  expect(response.status()).toBe(308);
  expect(response.headers().location).toMatch(/\/zip\/32\?part=2$/);
});

test("proposal and draft structured data tracks canonical URLs and distinct part titles", async ({ page }) => {
  for (const path of ["/zip/32", "/zip/32?part=2", "/draft/draft-arya-dairaemma-disable-addition-of-transparent-chain-value"]) {
    await page.goto(path);
    const nodes = await page.locator('script[type="application/ld+json"]').evaluateAll((scripts) =>
      scripts.flatMap((script) => JSON.parse(script.textContent ?? "{}")["@graph"] ?? []));
    const article = nodes.find((node) => node["@type"] === "TechArticle");
    const breadcrumbs = nodes.find((node) => node["@type"] === "BreadcrumbList");
    expect(article.url).toBe(`https://zips.tools${path}`);
    expect(article.headline + " · zips.tools").toBe(await page.title());
    expect(article.image).toBe(`https://zips.tools/og/${path.split("/").at(-1)!.split("?")[0]}.png`);
    expect(breadcrumbs.itemListElement.at(-1).item).toBe(article.url);
    if (path.includes("part=2")) {
      expect(article.headline).toContain(" — Part 2");
      await expect(page.locator('meta[property="og:title"]')).toHaveAttribute("content", article.headline);
      await expect(page.locator('meta[name="twitter:title"]')).toHaveAttribute("content", article.headline);
    }
  }
});
