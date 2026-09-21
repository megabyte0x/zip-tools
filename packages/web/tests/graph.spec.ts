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

test("home renders a ready 3D graph and reports focus search results", async ({ page }) => {
  const { surface } = await readyGraph(page, "/");
  await expect(surface.getByText("Graph ready")).toBeVisible();
  await expect(page.getByRole("region", { name: "Accessible citation nodes" })).toContainText("ZIP");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Activate graph" })).toBeVisible();
  await page.getByRole("button", { name: "Activate graph" }).click();

  const search = surface.getByRole("textbox", { name: "Search" });
  await search.fill("ZIP 999999");
  await surface.getByRole("button", { name: "Focus" }).click();
  await expect(surface.getByRole("status")).toContainText('No graph node matches "ZIP 999999".');

  await search.fill("ZIP 32");
  await surface.getByRole("button", { name: "Focus" }).click();
  await expect(surface.getByRole("status")).toContainText("Focused ZIP 32:");
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
  await surface.getByRole("textbox", { name: "Search" }).fill("ZIP 32");
  await surface.getByRole("button", { name: "Focus" }).click();
  await expect(surface.getByRole("status")).toContainText("Focused ZIP 32:");
  await page.waitForTimeout(1_000);
  const canvas = surface.locator("canvas");
  const rendered = await canvas.screenshot();
  const classes = await classifyRenderedPixels(page, rendered);
  expect(classes.nodePixels, JSON.stringify(classes)).toBeGreaterThan(100);
  const [box, point] = await Promise.all([
    canvas.boundingBox(),
    page.evaluate(async (png) => {
      const image = new Image();
      image.src = `data:image/png;base64,${png}`;
      await image.decode();
      const copy = document.createElement("canvas");
      copy.width = image.naturalWidth;
      copy.height = image.naturalHeight;
      const context = copy.getContext("2d", { willReadFrequently: true });
      context!.drawImage(image, 0, 0);
      const pixels = context!.getImageData(0, 0, copy.width, copy.height).data;
      let best = { x: copy.width / 2, y: copy.height / 2, score: -1 };
      for (let y = Math.floor(copy.height * 0.2); y < copy.height * 0.8; y += 1) {
        for (let x = Math.floor(copy.width * 0.2); x < copy.width * 0.8; x += 1) {
          const index = (y * copy.width + x) * 4;
          const score = pixels[index] + pixels[index + 1] + pixels[index + 2];
          if (score > best.score) best = { x, y, score };
        }
      }
      return best;
    }, rendered.toString("base64")),
  ]);
  expect(point.score, JSON.stringify(point)).toBeGreaterThan(150);
  await page.mouse.move(box!.x + point.x, box!.y + point.y);
  await page.waitForTimeout(250);
  await page.mouse.down();
  await page.mouse.up();
  await expect(page).toHaveURL(/\/zip\/\d+(?:$|[?#])/);
});

test("development scene observer finds actual visible citation-link objects", async ({ page }) => {
  test.skip(!expectDevelopmentObservers, "scene observer is intentionally absent from production builds");
  await readyGraph(page, "/graph");
  expect(await visibleLinkCount(page), "real scene must contain independently visible citation links").toBeGreaterThan(100);
});
