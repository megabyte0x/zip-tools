import { expect, test } from "@playwright/test";

const expectDevelopmentObservers = process.env.ZIP_TEST_GRAPH_OBSERVERS === "development";

async function classifyRenderedPixels(page: import("@playwright/test").Page, png: Buffer) {
  return page.evaluate(async (encoded) => {
    const image = new Image();
    image.src = `data:image/png;base64,${encoded}`;
    await image.decode();
    const copy = document.createElement("canvas");
    copy.width = image.naturalWidth;
    copy.height = image.naturalHeight;
    const context = copy.getContext("2d", { willReadFrequently: true });
    context!.drawImage(image, 0, 0);
    const pixels = context!.getImageData(0, 0, copy.width, copy.height).data;
    let nodePixels = 0;
    for (let index = 0; index < pixels.length; index += 4) {
      const red = pixels[index];
      const green = pixels[index + 1];
      const blue = pixels[index + 2];
      const spread = Math.max(red, green, blue) - Math.min(red, green, blue);
      if (red > 95 && green > 75 && blue < red - 18 && spread > 25) nodePixels += 1;
    }
    return { nodePixels };
  }, png.toString("base64"));
}

async function cameraPosition(page: import("@playwright/test").Page) {
  return page.evaluate(() => {
    const observe = (window as Window & { __ZIP_TEST_GRAPH_CAMERA__?: () => [number, number, number] })
      .__ZIP_TEST_GRAPH_CAMERA__;
    if (!observe) throw new Error("Graph camera observation hook is unavailable");
    return observe();
  });
}

async function visibleLinkCount(page: import("@playwright/test").Page) {
  return page.evaluate(() => {
    const observe = (window as Window & { __ZIP_TEST_GRAPH_VISIBLE_LINKS__?: () => number })
      .__ZIP_TEST_GRAPH_VISIBLE_LINKS__;
    if (!observe) throw new Error("Graph scene observation hook is unavailable");
    return observe();
  });
}

async function observeGraphStateTransitions(page: import("@playwright/test").Page) {
  await page.addInitScript(() => {
    const testWindow = window as Window & { __ZIP_TEST_GRAPH_STATES__?: string[] };
    const states: string[] = [];
    testWindow.__ZIP_TEST_GRAPH_STATES__ = states;
    const record = (element: Element) => {
      if (element.getAttribute("data-testid") !== "graph-surface") return;
      const state = element.getAttribute("data-state");
      if (state && states.at(-1) !== state) states.push(state);
    };
    new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === "attributes") record(mutation.target as Element);
        for (const node of mutation.addedNodes) {
          if (!(node instanceof Element)) continue;
          record(node);
          node.querySelectorAll('[data-testid="graph-surface"]').forEach(record);
        }
      }
    }).observe(document, {
      attributeFilter: ["data-state"],
      attributes: true,
      childList: true,
      subtree: true,
    });
  });
}

async function readyGraph(page: import("@playwright/test").Page, path: "/" | "/graph") {
  await page.goto(path);
  const surface = page.getByTestId("graph-surface");
  await expect(surface).toHaveAttribute("data-state", "ready", { timeout: 15_000 });
  const canvas = surface.locator("canvas");
  await expect(canvas).toBeVisible();
  expect(
    await canvas.evaluate((element: HTMLCanvasElement) => {
      const context = element.getContext("webgl2") ?? element.getContext("webgl");
      return Boolean(context && !context.isContextLost());
    }),
    "ready graph must expose a live, non-lost WebGL canvas",
  ).toBe(true);
  const box = await canvas.boundingBox();
  expect(box?.width ?? 0).toBeGreaterThan(300);
  expect(box?.height ?? 0).toBeGreaterThan(250);
  await expect(surface.getByText("Citation graph is unavailable in this browser.")).toHaveCount(0);
  return { surface, box: box! };
}

test("home renders a ready 3D graph without graph toolbar controls", async ({ page }) => {
  const { surface } = await readyGraph(page, "/");
  await expect(page.getByRole("region", { name: "Accessible citation nodes" })).toHaveCount(0);
  await expect(surface.getByRole("textbox", { name: "Search" })).toHaveCount(0);
  await expect(surface.getByRole("button", { name: "Focus" })).toHaveCount(0);
  await expect(surface.getByRole("button", { name: "Done exploring" })).toHaveCount(0);
  await expect(surface.getByRole("checkbox", { name: "Show labels" })).toHaveCount(0);
  await expect(surface.getByRole("status")).toHaveCount(0);
});

test("home graph nodes open their ZIP when clicked", async ({ page }) => {
  const { surface } = await readyGraph(page, "/");
  await surface.getByRole("button", { name: "Fit graph" }).click();
  await page.waitForTimeout(500);
  const point = await page.evaluate(() => {
    const observe = (window as Window & {
      __ZIP_TEST_GRAPH_NODE_POINT__?: (id: number) => { x: number; y: number } | null;
    }).__ZIP_TEST_GRAPH_NODE_POINT__;
    if (!observe) throw new Error("Graph node position observer is unavailable");
    return observe(32);
  });
  expect(point).not.toBeNull();
  await page.mouse.click(point!.x, point!.y);
  await expect(page).toHaveURL(/\/zip\/32(?:$|[?#])/);
});

test("graph exposes loading-to-ready state and a live production-observable WebGL canvas", async ({ page }) => {
  await observeGraphStateTransitions(page);
  await readyGraph(page, "/graph");
  const states = await page.evaluate(
    () => (window as Window & { __ZIP_TEST_GRAPH_STATES__?: string[] }).__ZIP_TEST_GRAPH_STATES__ ?? [],
  );
  expect(states).toContain("loading");
  expect(states).toContain("ready");
  expect(states.indexOf("loading")).toBeLessThan(states.indexOf("ready"));
});

test("expanded graph camera controls change pixels and reset", async ({ page }) => {
  const { surface } = await readyGraph(page, "/graph");
  const canvas = surface.locator("canvas");
  const before = await canvas.screenshot();
  await surface.getByRole("button", { name: "Zoom in" }).click();
  await page.waitForTimeout(500);
  const zoomed = await canvas.screenshot();
  expect(zoomed.equals(before)).toBe(false);
  await surface.getByRole("button", { name: "Reset" }).click();
  await page.waitForTimeout(500);
  await expect(surface).toHaveAttribute("data-camera-action", "reset");
  const reset = await canvas.screenshot();
  expect(reset.equals(zoomed), "reset must visibly reverse the zoomed camera state").toBe(false);
  const box = await canvas.boundingBox();
  await page.mouse.move(box!.x + box!.width * 0.45, box!.y + box!.height * 0.5);
  await page.mouse.down();
  await page.mouse.move(box!.x + box!.width * 0.6, box!.y + box!.height * 0.55, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(300);
  const rotated = await canvas.screenshot();
  expect(rotated.equals(reset)).toBe(false);
});

test("overview camera can fit core and all", async ({ page }) => {
  const { surface } = await readyGraph(page, "/graph");
  await expect(surface).toHaveAttribute("data-camera-action", "overview");
  await surface.getByRole("button", { name: "Zoom in" }).click();
  await surface.getByRole("button", { name: "Fit graph" }).click();
  await expect(surface).toHaveAttribute("data-camera-action", "overview");
  await surface.getByRole("button", { name: "Reset" }).click();
  await expect(surface).toHaveAttribute("data-camera-action", "reset");
  await page.getByRole("region", { name: "Citation graph" }).getByRole("combobox").selectOption("nu6.3");
  await expect(surface).toHaveAttribute("data-camera-action", "overview");
});

test("development observer tracks the actual camera through zoom and reset", async ({ page }) => {
  test.skip(!expectDevelopmentObservers, "camera observer is intentionally absent from production builds");
  const { surface } = await readyGraph(page, "/graph");
  const cameraBefore = await cameraPosition(page);
  await surface.getByRole("button", { name: "Zoom in" }).click();
  await page.waitForTimeout(500);
  const cameraZoomed = await cameraPosition(page);
  expect(Math.hypot(...cameraZoomed)).toBeLessThan(Math.hypot(...cameraBefore));
  await surface.getByRole("button", { name: "Reset" }).click();
  await page.waitForTimeout(500);
  const cameraReset = await cameraPosition(page);
  expect(cameraReset, "reset must move the actual renderer camera from its zoomed position").not.toEqual(cameraZoomed);
});

test("actual canvas context loss shows fallback and retry restores 3D", async ({ page }) => {
  const { surface } = await readyGraph(page, "/graph");
  await surface.locator("canvas").dispatchEvent("webglcontextlost");
  await expect(surface).toHaveAttribute("data-state", "failed");
  await expect(page.getByText("Citation graph is unavailable in this browser.")).toBeVisible();
  await expect(page.getByRole("region", { name: "Citation nodes with direction" })).toHaveCount(0);
  await surface.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByTestId("graph-surface")).toHaveAttribute("data-state", "ready", { timeout: 15_000 });
});

test("pre-ready renderer initialization failure shows fallback and retry recovers", async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    let failuresRemaining = 1;
    const testWindow = window as Window & { __ZIP_TEST_WEBGL_CONTEXT_FAILURES__?: number };
    testWindow.__ZIP_TEST_WEBGL_CONTEXT_FAILURES__ = 0;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, ...args: unknown[]) {
      if (type === "webgl2" && failuresRemaining > 0) {
        failuresRemaining -= 1;
        testWindow.__ZIP_TEST_WEBGL_CONTEXT_FAILURES__! += 1;
        return null;
      }
      return Reflect.apply(original, this, [type, ...args]);
    } as typeof HTMLCanvasElement.prototype.getContext;
  });
  await page.goto("/graph");
  const surface = page.getByTestId("graph-surface");
  await expect(surface).toHaveAttribute("data-state", "failed");
  await expect(surface).toContainText("Citation graph is unavailable in this browser.");
  await expect(surface.locator("canvas")).toHaveCount(0);
  expect(
    await page.evaluate(
      () => (window as Window & { __ZIP_TEST_WEBGL_CONTEXT_FAILURES__?: number }).__ZIP_TEST_WEBGL_CONTEXT_FAILURES__,
    ),
  ).toBe(1);
  await surface.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByTestId("graph-surface")).toHaveAttribute("data-state", "ready", { timeout: 15_000 });
  const canvas = page.getByTestId("graph-surface").locator("canvas");
  await expect(canvas).toBeVisible();
  expect(
    await canvas.evaluate((element: HTMLCanvasElement) => {
      const context = element.getContext("webgl2");
      return Boolean(context && !context.isContextLost());
    }),
  ).toBe(true);
});

test("empty filtered graph has a distinct empty state", async ({ page }) => {
  const { surface } = await readyGraph(page, "/graph");
  const graph = page.getByRole("region", { name: "Citation graph" });
  await graph.getByRole("combobox").evaluate((select: HTMLSelectElement) => {
    const option = document.createElement("option");
    option.value = "no-such-network-upgrade";
    option.text = "no-such-network-upgrade";
    select.append(option);
    select.value = option.value;
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await expect(surface).toHaveAttribute("data-state", "empty");
  await expect(surface).toContainText("No citation nodes match this network upgrade.");
});

test("focused assigned node can be clicked on the real canvas", async ({ page }) => {
  const { surface } = await readyGraph(page, "/graph");
  await surface.getByRole("button", { name: "Fit graph" }).click();
  await page.waitForTimeout(1_000);
  const canvas = surface.locator("canvas");
  const rendered = await canvas.screenshot();
  const classes = await classifyRenderedPixels(page, rendered);
  expect(classes.nodePixels, JSON.stringify(classes)).toBeGreaterThan(100);
  const point = await page.evaluate(() => {
    const observe = (window as Window & {
      __ZIP_TEST_GRAPH_NODE_POINT__?: (id: number) => { x: number; y: number } | null;
    }).__ZIP_TEST_GRAPH_NODE_POINT__;
    if (!observe) throw new Error("Graph node position observer is unavailable");
    return observe(32);
  });
  expect(point).not.toBeNull();
  await page.mouse.move(point!.x, point!.y);
  await expect(surface.getByTestId("graph-node-details")).toContainText("ZIP 32:");
  await page.mouse.click(point!.x, point!.y);
  await expect(page).toHaveURL(/\/zip\/32(?:$|[?#])/);
});

test("development scene observer finds actual visible citation-link objects", async ({ page }) => {
  test.skip(!expectDevelopmentObservers, "scene observer is intentionally absent from production builds");
  await readyGraph(page, "/graph");
  expect(await visibleLinkCount(page), "real scene must contain independently visible citation links").toBeGreaterThan(100);
});

test("hovering a node shows a styled tooltip and fills the details panel", async ({ page }) => {
  const { surface } = await readyGraph(page, "/graph");
  const details = surface.getByTestId("graph-node-details");
  await expect(details).toHaveText("Hover or tap a node to see its title and citations.");
  await surface.getByRole("button", { name: "Fit graph" }).click();
  await page.waitForTimeout(500);
  const point = await page.evaluate(() => {
    const observe = (window as Window & {
      __ZIP_TEST_GRAPH_NODE_POINT__?: (id: number) => { x: number; y: number } | null;
    }).__ZIP_TEST_GRAPH_NODE_POINT__;
    if (!observe) throw new Error("Graph node position observer is unavailable");
    return observe(32);
  });
  expect(point).not.toBeNull();
  await page.mouse.move(point!.x, point!.y);
  const tooltip = surface.locator(".float-tooltip-kap");
  await expect(details).toContainText(/ZIP \d+:/);
  await expect(details).toContainText(/Cites \d+ · Cited by \d+/);
  await expect(details.getByRole("link", { name: /Open ZIP \d+/ })).toHaveAttribute("href", /\/zip\/\d+/);
  await expect(tooltip).toContainText(/(ZIP \d+: .+|\d+ — Unassigned)/);
  await expect(tooltip).toContainText(/Cites \d+ · Cited by \d+/);
  await expect(details).toContainText(/Cites \d+ · Cited by \d+/);
  const style = await tooltip.evaluate((el) => {
    const s = getComputedStyle(el);
    return { border: s.borderTopColor, radius: s.borderTopLeftRadius };
  });
  expect(style.border).not.toBe("rgba(0, 0, 0, 0)");
  expect(style.radius).not.toBe("3px");
});

test("node number labels render by default", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await readyGraph(page, "/graph");
  await page.waitForTimeout(1_000);
  const count = await page.evaluate(() =>
    (window as Window & { __ZIP_TEST_GRAPH_LABELS__?: () => number }).__ZIP_TEST_GRAPH_LABELS__!());
  expect(count).toBeGreaterThan(0);
  expect(count).toBeLessThanOrEqual(12);
});

test("featured labels stay capped and hover adds one label", async ({ page }) => {
  await readyGraph(page, "/graph");
  const labels = () => page.evaluate(() =>
    (window as Window & { __ZIP_TEST_GRAPH_LABELS__?: () => number }).__ZIP_TEST_GRAPH_LABELS__!());
  await expect.poll(labels).toBeGreaterThan(0);
  const featuredCount = await labels();
  expect(featuredCount).toBeLessThanOrEqual(12);
  const point = await page.evaluate(() => {
    const observe = (window as Window & {
      __ZIP_TEST_GRAPH_NODE_POINT__?: (id: number) => { x: number; y: number } | null;
    }).__ZIP_TEST_GRAPH_NODE_POINT__;
    if (!observe) throw new Error("Graph node position observer is unavailable");
    return observe(32);
  });
  expect(point).not.toBeNull();
  await page.mouse.move(point!.x, point!.y);
  await expect.poll(labels).toBeLessThanOrEqual(13);
});

test("touch help and status legend stay usable on mobile", async ({ page, browser }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/graph");
  await readyGraph(page, "/graph");
  const fineHelp = await page.locator('[class*="help"]').innerText();

  const context = await browser.newContext({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } });
  const touchPage = await context.newPage();
  await touchPage.goto("/graph");
  const touchSurface = touchPage.getByTestId("graph-surface");
  await expect(touchSurface).toHaveAttribute("data-state", "ready", { timeout: 15_000 });
  const touchHelp = await touchPage.locator('[class*="help"]').innerText();
  expect(touchHelp).not.toEqual(fineHelp);
  expect(touchHelp).toMatch(/tap|touch|controls/i);
  expect(touchHelp).not.toMatch(/right-drag/i);

  const legend = touchPage.getByRole("list", { name: "Status colours" });
  const labels = ["Draft", "Proposed", "Active", "Final", "Withdrawn", "Rejected", "Obsolete", "Reserved"];
  const visible = await legend.evaluate((element, expected) => {
    const box = element.getBoundingClientRect();
    return expected.map((label) => {
      const item = [...element.querySelectorAll("li")].find((node) => node.textContent?.trim() === label);
      if (!item) return { label, inside: false };
      const rect = item.getBoundingClientRect();
      const inside = rect.width > 0
        && rect.height > 0
        && rect.top >= box.top - 1
        && rect.bottom <= box.bottom + 1
        && rect.left >= box.left - 1
        && rect.right <= box.right + 1;
      return { label, inside };
    });
  }, labels);
  for (const item of visible) {
    expect(item.inside, item.label).toBe(true);
  }
  await context.close();
});
