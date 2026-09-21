import { expect, test } from "@playwright/test";

test("search and discrete filters survive navigation, back, and reload", async ({ page }) => {
  await page.goto("/zips?keep=1#results");

  const search = page.getByRole("searchbox", { name: "Search", exact: true });
  await search.fill("Orchard");
  await expect(page).toHaveURL(/q=Orchard/);
  expect(new URL(page.url()).searchParams.get("keep")).toBe("1");
  expect(new URL(page.url()).hash).toBe("#results");

  await page.getByLabel("NU", { exact: true }).selectOption("nu6.3");
  await expect(page).toHaveURL(/nu=nu6\.3/);
  await expect(page.getByText("2 results", { exact: true })).toBeVisible();

  await page.getByRole("link", { name: "Orchard to Ironwood Migration" }).click();
  await expect(page).toHaveURL(/\/zip\/318$/);
  await page.goBack();
  await expect(search).toHaveValue("Orchard");
  await expect(page.getByLabel("NU", { exact: true })).toHaveValue("nu6.3");

  const restoredUrl = page.url();
  await page.reload();
  await expect(search).toHaveValue("Orchard");
  await expect(page.getByLabel("NU", { exact: true })).toHaveValue("nu6.3");
  expect(page.url()).toBe(restoredUrl);
});

test("owner search, drafts, sorting, and empty-state clearing work", async ({ page }) => {
  await page.goto("/zips");

  await page.getByRole("searchbox", { name: "Search", exact: true }).fill("Schell Carl Scivally");
  await expect(page.getByText("Matching owner: Schell Carl Scivally")).toBeVisible();

  await page.getByRole("button", { name: "Clear filters" }).click();
  await page.getByLabel("Kind", { exact: true }).selectOption("draft");
  await expect(page).toHaveURL(/kind=draft/);
  await expect(
    page.locator("tbody tr").first().getByRole("link", { name: "Draft", exact: true }),
  ).toBeVisible();

  await page.getByLabel("Sort", { exact: true }).selectOption("title");
  const titles = await page.locator("tbody tr td:nth-child(2) a").allTextContents();
  const sorted = [...titles].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
  expect(titles).toEqual(sorted);

  await page.getByRole("searchbox", { name: "Search", exact: true }).fill("no-such-proposal-xyz");
  await expect(page.getByText("No ZIPs match your filters.")).toBeVisible();
  await page.getByRole("button", { name: "Clear filters" }).click();
  await expect(page.getByText(/results?$/)).toBeVisible();
  await expect(page.getByRole("searchbox", { name: "Search", exact: true })).toHaveValue("");
  await expect(page).toHaveURL(/\/zips$/);
});

test("revision detail is disclosed and mobile layout does not overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/zips?q=317");

  await page.getByText("Draft (revision details)").click();
  await expect(
    page.getByText("[Revision 0] Active, [Revision 1: NU6.3] Draft, [Revision 2] Draft"),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    ),
  ).toBe(true);
});
