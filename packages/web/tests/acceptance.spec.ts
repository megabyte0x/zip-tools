import { expect, test, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

const evidenceDir = resolve(
  process.cwd(),
  "../../docs/superpowers/reports/2026-09-21-reader-explorer-3d-screenshots",
);
const draftSlug = "draft-arya-dairaemma-disable-addition-of-transparent-chain-value";
const requiredRoutes = [
  "/",
  "/zips",
  "/zips?kind=draft",
  "/graph",
  "/zip/32",
  "/zip/312",
  "/zip/317",
  "/zip/48",
  `/draft/${draftSlug}`,
  "/nu/nu6.3",
  "/list",
] as const;

function consoleFailures(page: Page) {
  const failures: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") failures.push(`console: ${message.text()}`);
  });
  page.on("pageerror", (error) => failures.push(`pageerror: ${error.message}`));
  return failures;
}

async function expectNoDocumentOverflow(page: Page, route: string) {
  await expect.soft
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), {
      message: `${route} must not have document-level horizontal overflow`,
    })
    .toBe(true);
}

async function expectReadyGraph(page: Page) {
  const surface = page.getByTestId("graph-surface");
  await expect(surface).toHaveAttribute("data-state", "ready", { timeout: 15_000 });
  const canvas = surface.locator("canvas");
  await expect(canvas).toBeVisible();
  expect(
    await canvas.evaluate((element: HTMLCanvasElement) => {
      const context = element.getContext("webgl2") ?? element.getContext("webgl");
      return Boolean(context && !context.isContextLost());
    }),
    "3D acceptance requires a live, non-lost WebGL context, not canvas existence",
  ).toBe(true);
  const pixels = await canvas.screenshot();
  expect(new Set(pixels).size, "real graph pixels must not be a blank/uniform canvas").toBeGreaterThan(100);
  await expect(surface.getByText(/\d+ nodes · \d+ citations/)).toBeVisible();
  await expect(surface.getByText("Citation graph is unavailable in this browser.")).toHaveCount(0);
  return surface;
}

async function contrastRatio(page: Page, selector: string) {
  return page.locator(selector).first().evaluate((element) => {
    const parse = (value: string) => {
      const match = value.match(/[\d.]+/g)?.map(Number) ?? [];
      return match.slice(0, 3);
    };
    const luminance = (rgb: number[]) => {
      const values = rgb.map((channel) => {
        const value = channel / 255;
        return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * values[0] + 0.7152 * values[1] + 0.0722 * values[2];
    };
    const foreground = parse(getComputedStyle(element).color);
    let node: Element | null = element;
    let background = [0, 0, 0];
    while (node) {
      const color = getComputedStyle(node).backgroundColor;
      const rgba = color.match(/[\d.]+/g)?.map(Number) ?? [];
      if (rgba.length >= 3 && (rgba.length < 4 || rgba[3] > 0)) {
        background = rgba.slice(0, 3);
        break;
      }
      node = node.parentElement;
    }
    const lighter = Math.max(luminance(foreground), luminance(background));
    const darker = Math.min(luminance(foreground), luminance(background));
    return (lighter + 0.05) / (darker + 0.05);
  });
}

test("site header omits the network-upgrade tab strip", async ({ page }) => {
  await page.goto("/");

  await expect(page.locator('[aria-label="Network upgrades"]')).toHaveCount(0);
});

test("home links to the ZIP directory without mounting its explorer", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("region", { name: "ZIP explorer" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Browse ZIPs", exact: true })).toHaveAttribute("href", "/zips");
});

test("required production routes render without console failures or document overflow", async ({ page }) => {
  const failures = consoleFailures(page);
  for (const route of requiredRoutes) {
    const response = await page.goto(route);
    expect(response?.status(), route).toBe(200);
    await expect(page.locator("main")).toBeVisible();
    if (route === "/zip/317") {
      mkdirSync(evidenceDir, { recursive: true });
      await page.locator("math").evaluateAll((nodes) => {
        const widest = nodes.sort(
          (left, right) => right.getBoundingClientRect().width - left.getBoundingClientRect().width,
        )[0];
        widest?.scrollIntoView({ block: "center" });
      });
      await page.evaluate(() => scrollTo(document.documentElement.scrollWidth, scrollY));
      await page.screenshot({ path: resolve(evidenceDir, "issue-zip317-overflow-1280.png") });
    }
    await expectNoDocumentOverflow(page, route);
  }
  const missing = await page.goto("/zip/999999");
  expect(missing?.status()).toBe(404);
  await expect(page.getByText("No ZIP matches", { exact: true })).toBeVisible();
  await expectNoDocumentOverflow(page, "/zip/999999");
  expect(failures.filter((failure) => !failure.includes("status of 404"))).toEqual([]);
});

test("reader fidelity, navigation, bookmarks, and explorer history are retained", async ({ page }) => {
  const failures = consoleFailures(page);
  await page.goto("/zip/48");
  const body = page.getByTestId("reader-body");
  await expect(body).toBeVisible();
  expect((await body.innerText()).length).toBeGreaterThan(1_000);
  const toc = page.getByRole("navigation", { name: "Contents" });
  const hash = await toc.getByRole("link").first().getAttribute("href");
  expect(hash).toMatch(/^#[^#]+/);
  await expect(page.locator(hash!)).toHaveCount(1);
  await expect(body.locator('a[href^="/zip/"]').first()).toBeVisible();
  await expect(page.getByRole("link", { name: "GitHub", exact: true })).toHaveAttribute(
    "href",
    /github\.com\/zcash\/zips\/blob\/[0-9a-f]{40}\//,
  );
  await expect(page.getByRole("link", { name: /Previous ZIP/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Next ZIP/ })).toBeVisible();

  const bookmark = page.getByRole("button", { name: "Bookmark", exact: true }).first();
  await bookmark.click();
  await expect(page.getByRole("button", { name: "Bookmarked", exact: true }).first()).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.reload();
  await expect(page.getByRole("button", { name: "Bookmarked", exact: true }).first()).toBeVisible();

  await page.goto("/zip/312");
  await expect(page.getByText("2022-08-dd", { exact: true }).last()).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: "Limited conversion." })).toBeVisible();
  await expect(page.getByTestId("reader-body")).not.toContainText(".. raw::");

  await page.getByRole("link", { name: "Browse" }).click();
  await page.getByRole("searchbox", { name: "Search", exact: true }).fill("317");
  await expect(page).toHaveURL(/\/zips\?q=317$/);
  await page.getByLabel("Kind", { exact: true }).selectOption("numbered");
  await expect(page).toHaveURL(/\/zips\?q=317&kind=numbered$/);
  await page.getByText("Draft (revision details)").click();
  await expect(page.getByText("[Revision 0] Active, [Revision 1: NU6.3] Draft, [Revision 2] Draft")).toBeVisible();
  await page.getByRole("link", { name: "Proportional Transfer Fee Mechanism" }).click();
  await expect(page).toHaveURL(/\/zip\/317$/);
  await page.goBack({ waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(/\/zips\?q=317&kind=numbered$/);
  await expect(page.getByLabel("Search", { exact: true })).toHaveValue("317");
  await expect(page.getByLabel("Kind", { exact: true })).toHaveValue("numbered");
  expect(failures).toEqual([]);
});

test("real 3D graph supports camera, focus, filters, context loss, and retry", async ({ page }) => {
  const failures = consoleFailures(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/graph");
  const surface = await expectReadyGraph(page);
  const canvas = surface.locator("canvas");
  const before = await canvas.screenshot();
  await surface.getByRole("button", { name: "Zoom in" }).click();
  await page.waitForTimeout(500);
  expect((await canvas.screenshot()).equals(before)).toBe(false);
  await surface.getByRole("button", { name: "Reset" }).click();
  await expect(surface).toHaveAttribute("data-camera-action", "reset");
  const box = await canvas.boundingBox();
  await page.mouse.move(box!.x + box!.width * 0.4, box!.y + box!.height * 0.5);
  await page.mouse.down();
  await page.mouse.move(box!.x + box!.width * 0.6, box!.y + box!.height * 0.55, { steps: 8 });
  await page.mouse.up();

  const search = surface.getByRole("textbox", { name: "Search" });
  await search.fill("no-such-node");
  await surface.getByRole("button", { name: "Focus" }).click();
  await expect(surface.getByRole("status")).toContainText("No graph node matches");
  await search.fill("ZIP 32");
  await surface.getByRole("button", { name: "Focus" }).click();
  await expect(surface.getByRole("status")).toContainText("Focused ZIP 32:");
  await page.getByRole("region", { name: "Citation graph" }).getByRole("combobox").selectOption("nu6.3");
  await expect(surface.getByText(/\d+ nodes · \d+ citations/)).toBeVisible();
  await surface.locator("canvas").dispatchEvent("webglcontextlost");
  await expect(surface).toHaveAttribute("data-state", "failed");
  await expect(surface).toContainText("Citation graph is unavailable in this browser.");
  await surface.getByRole("button", { name: "Try again" }).click();
  await expectReadyGraph(page);
  expect(failures).toEqual([]);
});

test("home graph preserves mobile page scroll outside its inactive canvas", async ({ page }) => {
  const failures = consoleFailures(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const homeSurface = await expectReadyGraph(page);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Explore graph", exact: true })).toBeVisible();
  await page.evaluate(() => scrollTo(0, 900));
  await page.mouse.move(8, 160);
  const initialY = await page.evaluate(() => scrollY);
  await page.mouse.wheel(0, -500);
  await expect.poll(() => page.evaluate(() => scrollY)).toBeLessThan(initialY);
  await expect(homeSurface).toHaveAttribute("data-state", "ready");
  expect(failures).toEqual([]);
});

test("keyboard flow, contrast, effective 200 percent zoom, and contained overflow meet acceptance", async ({ page }) => {
  const failures = consoleFailures(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/zip/48");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Skip to content" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect.soft(page.locator("main")).toBeFocused();
  await page.keyboard.press("Tab");
  const focused = page.locator(":focus");
  await expect(focused).toBeVisible();
  expect(await focused.evaluate((element) => {
    const style = getComputedStyle(element);
    return style.outlineStyle !== "none" || style.boxShadow !== "none";
  })).toBe(true);
  expect(await contrastRatio(page, "body")).toBeGreaterThanOrEqual(4.5);
  expect(await contrastRatio(page, "article p")).toBeGreaterThanOrEqual(4.5);

  for (const route of ["/", "/zips", "/zip/48", "/graph"]) {
    await page.setViewportSize({ width: 720, height: 450 });
    await page.goto(route);
    await expectNoDocumentOverflow(page, `${route} at effective 200% zoom`);
  }

  await page.goto("/zip/32");
  const wide = page.getByTestId("reader-body").locator("pre, table");
  expect(await wide.count()).toBeGreaterThan(0);
  for (const element of await wide.all()) {
    const metrics = await element.evaluate((node) => {
      const style = getComputedStyle(node);
      return { clientWidth: node.clientWidth, scrollWidth: node.scrollWidth, overflowX: style.overflowX };
    });
    if (metrics.scrollWidth > metrics.clientWidth) expect(["auto", "scroll"]).toContain(metrics.overflowX);
  }
  expect(failures).toEqual([]);
});

test("captures the 12 required responsive visual evidence views", async ({ page }) => {
  mkdirSync(evidenceDir, { recursive: true });
  const views = [
    { name: "home", route: "/" },
    { name: "explorer", route: "/zips" },
    { name: "reader", route: "/zip/48" },
    { name: "graph", route: "/graph" },
  ] as const;
  for (const width of [390, 768, 1440] as const) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
    for (const view of views) {
      await page.goto(view.route);
      if (view.name === "home" || view.name === "graph") await expectReadyGraph(page);
      await expectNoDocumentOverflow(page, `${view.route} at ${width}px`);
      await page.evaluate(() => scrollTo(0, 0));
      await page.screenshot({
        path: resolve(evidenceDir, `${view.name}-${width}.png`),
        fullPage: false,
      });
    }
  }
});
