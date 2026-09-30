import { expect, test } from "@playwright/test";

test("ZIP citation neighborhood uses the interactive 3D graph without a depth selector", async ({ page }) => {
  await page.goto("/zip/224");
  const citation = page.getByRole("region", { name: "Citation graph" });
  await expect(citation.getByRole("heading", { name: "Cites" })).toBeVisible();
  await expect(citation.getByRole("heading", { name: "Cited by" })).toBeVisible();
  const surface = citation.getByTestId("graph-surface");
  await citation.scrollIntoViewIfNeeded();
  await expect(surface).toHaveAttribute("data-state", "ready", { timeout: 15_000 });
  await expect(surface.locator("canvas")).toBeVisible();
  await expect(surface.getByRole("button", { name: "Zoom in" })).toBeVisible();
  await expect(citation.getByRole("combobox", { name: "Depth" })).toHaveCount(0);
});
