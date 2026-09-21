import { expect, test } from "@playwright/test";

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

async function readyGraph(page: import("@playwright/test").Page, path: "/" | "/graph") {
  await page.goto(path);
  const surface = page.getByTestId("graph-surface");
  await expect(surface).toHaveAttribute("data-state", "ready", { timeout: 15_000 });
  await expect(surface.locator("canvas")).toBeVisible();
  const box = await surface.locator("canvas").boundingBox();
  expect(box?.width ?? 0).toBeGreaterThan(300);
  expect(box?.height ?? 0).toBeGreaterThan(250);
  await expect(page.getByText("Citation graph is unavailable in this browser.")).toHaveCount(0);
  return { surface, box: box! };
}

test("home renders a ready 3D graph and reports focus search results", async ({ page }) => {
  const { surface } = await readyGraph(page, "/");
  await expect(surface.getByText("Graph ready")).toBeVisible();
  await expect(page.getByRole("region", { name: "Accessible citation nodes" })).toContainText("ZIP");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Activate graph" })).toBeVisible();
  await page.getByRole("button", { name: "Activate graph" }).click();

  const search = page.getByRole("textbox", { name: "Search" });
  await search.fill("ZIP 999999");
  await page.getByRole("button", { name: "Focus" }).click();
  await expect(page.getByRole("status")).toContainText('No graph node matches "ZIP 999999".');

  await search.fill("ZIP 32");
  await page.getByRole("button", { name: "Focus" }).click();
  await expect(page.getByRole("status")).toContainText("Focused ZIP 32:");
});

test("expanded graph camera controls change pixels and reset", async ({ page }) => {
  const { surface } = await readyGraph(page, "/graph");
  const canvas = surface.locator("canvas");
  const before = await canvas.screenshot();
  const cameraBefore = await cameraPosition(page);
  await page.getByRole("button", { name: "Zoom in" }).click();
  await page.waitForTimeout(500);
  const zoomed = await canvas.screenshot();
  const cameraZoomed = await cameraPosition(page);
  expect(zoomed.equals(before)).toBe(false);
  expect(Math.hypot(...cameraZoomed)).toBeLessThan(Math.hypot(...cameraBefore));
  await page.getByRole("button", { name: "Reset" }).click();
  await page.waitForTimeout(500);
  await expect(surface).toHaveAttribute("data-camera-action", "reset");
  const reset = await canvas.screenshot();
  expect(reset.equals(zoomed), "reset must visibly reverse the zoomed camera state").toBe(false);
  const cameraReset = await cameraPosition(page);
  expect(cameraReset, "reset must move the actual renderer camera from its zoomed position").not.toEqual(cameraZoomed);
  const box = await canvas.boundingBox();
  await page.mouse.move(box!.x + box!.width * 0.45, box!.y + box!.height * 0.5);
  await page.mouse.down();
  await page.mouse.move(box!.x + box!.width * 0.6, box!.y + box!.height * 0.55, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(300);
  const rotated = await canvas.screenshot();
  expect(rotated.equals(reset)).toBe(false);
});

test("actual canvas context loss shows fallback and retry restores 3D", async ({ page }) => {
  const { surface } = await readyGraph(page, "/graph");
  await surface.locator("canvas").dispatchEvent("webglcontextlost");
  await expect(surface).toHaveAttribute("data-state", "failed");
  await expect(page.getByText("Citation graph is unavailable in this browser.")).toBeVisible();
  await page.getByRole("button", { name: "Try again" }).click();
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
  await page.getByRole("button", { name: "Try again" }).click();
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
  await readyGraph(page, "/graph");
  await page.getByLabel("NU").evaluate((select: HTMLSelectElement) => {
    const option = document.createElement("option");
    option.value = "no-such-network-upgrade";
    option.text = "no-such-network-upgrade";
    select.append(option);
    select.value = option.value;
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
  const surface = page.getByTestId("graph-surface");
  await expect(surface).toHaveAttribute("data-state", "empty");
  await expect(surface).toContainText("No citation nodes match this network upgrade.");
});

test("focused assigned node can be clicked on the real canvas", async ({ page }) => {
  const { surface } = await readyGraph(page, "/graph");
  await page.getByRole("textbox", { name: "Search" }).fill("ZIP 32");
  await page.getByRole("button", { name: "Focus" }).click();
  await expect(page.getByRole("status")).toContainText("Focused ZIP 32:");
  await page.waitForTimeout(1_000);
  const canvas = surface.locator("canvas");
  const rendered = await canvas.screenshot();
  const classes = await classifyRenderedPixels(page, rendered);
  expect(classes.nodePixels, JSON.stringify(classes)).toBeGreaterThan(100);
  expect(await visibleLinkCount(page), "real scene must contain independently visible citation links").toBeGreaterThan(100);
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
