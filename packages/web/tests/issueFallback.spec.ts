import { expect, test, type Page } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const webRoot = fileURLToPath(new URL("..", import.meta.url));
const evidenceRunId = (process.env.ZIP_EVIDENCE_RUN_ID ?? `local-${Date.now()}-${process.pid}`)
  .replaceAll(/[^a-zA-Z0-9._-]/g, "_");
const evidenceDir = resolve(
  webRoot,
  "../../docs/superpowers/reports/2026-09-23-github-issue-body-fallback-screenshots",
  evidenceRunId,
);

const missingFixtureRenderScript = String.raw`
import { registerHooks } from "node:module";
import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

registerHooks({
  load(url, context, nextLoad) {
    if (url.endsWith(".css")) {
      return {
        format: "module",
        source: "export default new Proxy({}, { get: (_, key) => String(key) });",
        shortCircuit: true,
      };
    }
    return nextLoad(url, context);
  },
});

globalThis.React = React;
const [{ ReaderBody }, { missingReaderFixture }] = await Promise.all([
  import("./components/ReaderBody.tsx"),
  import("./lib/readerFixtures.ts"),
]);
process.stdout.write(renderToStaticMarkup(createElement(ReaderBody, {
  body: null,
  bodyKind: "none",
  officialUrl: "https://zips.z.cash/zip-0312",
  discussionsTo: null,
  document: missingReaderFixture,
})));
`;

function renderExistingMissingReaderFixture(): string {
  return execFileSync(
    process.execPath,
    ["--import", "tsx", "--eval", missingFixtureRenderScript],
    { cwd: webRoot, encoding: "utf8" },
  );
}

function collectBrowserFailures(page: Page) {
  const failures: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") failures.push(`console: ${message.text()}`);
  });
  page.on("pageerror", (error) => failures.push(`pageerror: ${error.message}`));
  return failures;
}

async function expectContentsTarget(page: Page, surface: "desktop" | "mobile") {
  const contents = surface === "desktop"
    ? page.locator('nav[aria-label="Contents"]:visible')
    : page.locator("details:visible").filter({ has: page.getByText("Contents", { exact: true }) });
  if (surface === "mobile") await contents.getByText("Contents", { exact: true }).click();

  const link = contents.getByRole("link").first();
  await expect(link).toBeVisible();
  const href = await link.getAttribute("href");
  expect(href).toMatch(/^#[^#]+$/);
  await link.click();

  const target = page.getByTestId("reader-body").locator(href!);
  await expect(target).toHaveCount(1);
  await expect(target).toBeVisible();
  expect(await target.evaluate((node) => /^H[1-6]$/.test(node.tagName))).toBe(true);
}

async function expectNoDocumentOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    ),
  ).toBe(true);
}

function renderedMath(body: ReturnType<Page["getByTestId"]>) {
  return body.locator(".katex").filter({ hasText: "ZKPoK" }).first();
}

async function captureReaderEvidence(page: Page, viewport: "desktop" | "mobile") {
  const body = page.getByTestId("reader-body");
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({ path: resolve(evidenceDir, `zip-2007-${viewport}-top.png`) });
  const table = body.locator("table").first();
  await table.scrollIntoViewIfNeeded();
  await page.screenshot({ path: resolve(evidenceDir, `zip-2007-${viewport}-table.png`) });
  const tableScrollport = table.locator("xpath=..");
  const tableScrolls = await tableScrollport.evaluate(
    (element) => element.scrollWidth > element.clientWidth,
  );
  if (tableScrolls) {
    await tableScrollport.evaluate((element) => {
      element.scrollLeft = element.scrollWidth;
    });
    await page.screenshot({ path: resolve(evidenceDir, `zip-2007-${viewport}-table-scroll-end.png`) });
    await tableScrollport.evaluate((element) => {
      element.scrollLeft = 0;
    });
  }
  const math = renderedMath(body);
  await expect(math).toBeVisible();
  await expect(math).toContainText("ZKPoK");
  await math.scrollIntoViewIfNeeded();
  const mathBox = await math.boundingBox();
  expect(mathBox?.width ?? 0).toBeGreaterThan(100);
  expect(mathBox?.height ?? 0).toBeGreaterThan(20);
  await math.screenshot({ path: resolve(evidenceDir, `zip-2007-${viewport}-math.png`) });
}

test("ZIP 2007 renders its saved issue body without GitHub requests or a provenance callout", async ({ page }) => {
  mkdirSync(evidenceDir, { recursive: true });
  const githubRequests: string[] = [];
  const failures = collectBrowserFailures(page);
  await page.route(/https:\/\/(?:api\.)?github\.com\//, async (route) => {
    githubRequests.push(route.request().url());
    await route.abort();
  });

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/zip/2007");
  const body = page.getByTestId("reader-body");
  await expect(body.getByRole("heading", { name: "Motivation", exact: true })).toBeVisible();
  await expect(body.locator("table").first()).toBeVisible();
  await expect(renderedMath(body)).toBeVisible();
  await expect(renderedMath(body)).toContainText("ZKPoK");
  await expect(page.getByTestId("issue-body-notice")).toHaveCount(0);
  await expect(page.getByRole("list", { name: "Status", exact: true })).toContainText("Reserved");
  await expectContentsTarget(page, "desktop");
  await expectNoDocumentOverflow(page);
  await captureReaderEvidence(page, "desktop");

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/zip/2007");
  await expect(body.getByRole("heading", { name: "Motivation", exact: true })).toBeVisible();
  const mobileTable = body.locator("table").first();
  await expect(mobileTable).toBeVisible();
  const tableLayout = await mobileTable.evaluate((table) => {
    const scrollport = table.parentElement!;
    return {
      scrollable: scrollport.scrollWidth > scrollport.clientWidth,
      overflowX: getComputedStyle(scrollport).overflowX,
    };
  });
  expect(tableLayout.scrollable).toBe(true);
  expect(tableLayout.overflowX).toMatch(/^(auto|scroll)$/);
  const finalColumnFitsMobileScrollport = await mobileTable.evaluate((table) => {
    const htmlTable = table as HTMLTableElement;
    const scrollport = htmlTable.parentElement!;
    scrollport.scrollLeft = scrollport.scrollWidth;
    const scrollportRect = scrollport.getBoundingClientRect();
    return [...htmlTable.rows].every((row) => {
      const finalCell = row.cells.item(row.cells.length - 1);
      if (!finalCell) return false;
      const cellRect = finalCell.getBoundingClientRect();
      return cellRect.left >= scrollportRect.left && cellRect.right <= scrollportRect.right;
    });
  });
  expect(finalColumnFitsMobileScrollport).toBe(true);
  await expectContentsTarget(page, "mobile");
  await expectNoDocumentOverflow(page);
  await captureReaderEvidence(page, "mobile");

  expect(githubRequests).toEqual([]);
  expect(failures).toEqual([]);
});

test("normal Markdown and RST reader bodies remain source-backed", async ({ page }) => {
  const failures = collectBrowserFailures(page);
  for (const route of ["/zip/48", "/zip/32"] as const) {
    await page.goto(route);
    const body = page.getByTestId("reader-body");
    await expect(body).toBeVisible();
    expect((await body.innerText()).trim().length, route).toBeGreaterThan(200);
    await expect(page.getByTestId("issue-body-notice")).toHaveCount(0);
  }
  expect(failures).toEqual([]);
});

test("existing missing reader fixture retains its official fallback in the browser", async ({ page }) => {
  await page.setContent(renderExistingMissingReaderFixture());

  const body = page.getByTestId("reader-body");
  await expect(body).toBeVisible();
  await expect(body).toContainText("No proposal body is available in this snapshot.");
  await expect(body.getByRole("link", { name: "Open on zips.z.cash" })).toHaveCount(1);
  await expect(body.getByRole("link", { name: "Read the linked GitHub issue" })).toHaveCount(0);
});
