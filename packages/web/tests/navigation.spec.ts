import { expect, test } from "@playwright/test";

test("primary navigation links to every discovery destination", async ({ page }) => {
  await page.goto("/zip/312");

  await expect(page.getByRole("link", { name: "ZIP.tools", exact: true })).toHaveAttribute("href", "/");
  await expect(page.getByRole("link", { name: "Skip to content" })).toHaveAttribute(
    "href",
    "#main-content",
  );

  const browse = page.getByRole("link", { name: "Browse", exact: true });
  const drafts = page.getByRole("link", { name: "Drafts", exact: true });

  await browse.click();
  await expect(page).toHaveURL(/\/zips$/);
  await expect(browse).toHaveAttribute("aria-current", "page");
  await expect(drafts).not.toHaveAttribute("aria-current", "page");

  await drafts.click();
  await expect(page).toHaveURL(/\/zips\?kind=draft$/);
  await expect(drafts).toHaveAttribute("aria-current", "page");
  await expect(browse).not.toHaveAttribute("aria-current", "page");

  await page.getByRole("link", { name: "Graph", exact: true }).click();
  await expect(page).toHaveURL(/\/graph$/);
  await expect(page.getByRole("link", { name: "Graph", exact: true })).toHaveAttribute(
    "aria-current",
    "page",
  );

  await page.getByRole("link", { name: /Reading List/ }).click();
  await expect(page).toHaveURL(/\/list$/);
});

test("header search supports keyboard selection, Escape, and no-hit browse", async ({ page }) => {
  await page.goto("/zip/312");
  const search = page.getByRole("combobox", { name: "Search ZIPs" });

  await search.fill("312");
  await expect(search).toHaveAttribute("aria-expanded", "true");
  await search.press("ArrowDown");
  const highlighted = page.getByRole("option").first();
  await expect(highlighted).toHaveAttribute("aria-selected", "true");
  await search.press("Escape");
  await expect(search).toHaveAttribute("aria-expanded", "false");
  await expect(search).toBeFocused();

  await search.fill("317");
  await search.press("ArrowDown");
  await search.press("Enter");
  await expect(page).toHaveURL(/\/zip\/317$/);

  const readerSearch = page.getByRole("combobox", { name: "Search ZIPs" });
  await readerSearch.fill("no proposal has this phrase 9d1c");
  await page.getByRole("search").press("Enter");
  await expect(page).toHaveURL(/\/zips\?q=no%20proposal%20has%20this%20phrase%209d1c$/);
});

test("Tab exits an open search combobox without entering its options", async ({ page }) => {
  await page.goto("/zip/312");
  const search = page.getByRole("combobox", { name: "Search ZIPs" });

  await search.fill("312");
  await expect(search).toHaveAttribute("aria-expanded", "true");
  await search.press("Tab");

  await expect(search).toHaveAttribute("aria-expanded", "false");
  await expect(page.getByRole("link", { name: "Browse", exact: true })).toBeFocused();
});

test("search is available on graph and reader routes", async ({ page }) => {
  await page.goto("/graph");
  await expect(page.getByRole("combobox", { name: "Search ZIPs" })).toBeVisible();
  await page.goto("/zip/312");
  await expect(page.getByRole("combobox", { name: "Search ZIPs" })).toBeVisible();
});

test("keyboard skip link moves focus to main without adding it to ordinary tab order", async ({ page }) => {
  await page.goto("/zip/48");

  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Skip to content" })).toBeFocused();
  await page.keyboard.press("Enter");

  const main = page.locator("main#main-content");
  await expect(main).toBeFocused();
  await expect(main).toHaveAttribute("tabindex", "-1");

  await page.reload();
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "ZIP.tools", exact: true })).toBeFocused();
});

test("keyboard path moves through the header search into a reader", async ({ page }) => {
  await page.goto("/zip/312");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Skip to content" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "ZIP.tools", exact: true })).toBeFocused();
  await page.keyboard.press("Tab");
  const search = page.getByRole("combobox", { name: "Search ZIPs" });
  await expect(search).toBeFocused();
  await search.fill("317");
  await search.press("ArrowDown");
  await search.press("Enter");
  await expect(page).toHaveURL(/\/zip\/317$/);
});

test("390px menu exposes navigation without page-width overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/zip/312");

  const toggle = page.getByRole("button", { name: "Open menu" });
  await expect(toggle).toBeVisible();
  const box = await toggle.boundingBox();
  expect(box?.height).toBeGreaterThanOrEqual(44);
  await toggle.click();
  await expect(page.getByRole("link", { name: "Browse", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: /Reading List/ })).toBeVisible();

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test("390px menu closes after query-only Drafts navigation", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/zips");

  const openMenu = page.getByRole("button", { name: "Open menu" });
  await openMenu.click();
  await page.getByRole("link", { name: "Drafts", exact: true }).click();

  await expect(page).toHaveURL(/\/zips\?kind=draft$/);
  await expect(openMenu).toBeVisible();
  await expect(page.getByRole("link", { name: "Drafts", exact: true })).not.toBeVisible();
});

for (const width of [768, 1440]) {
  test(`${width}px header has no page-width overflow`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/zip/312");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
}