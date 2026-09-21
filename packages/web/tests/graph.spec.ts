import { expect, test } from "@playwright/test";

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
  await page.getByRole("button", { name: "Zoom in" }).click();
  await page.waitForTimeout(500);
  const zoomed = await canvas.screenshot();
  expect(zoomed.equals(before)).toBe(false);
  await page.getByRole("button", { name: "Reset" }).click();
  await page.waitForTimeout(500);
  await expect(surface).toHaveAttribute("data-camera-action", "reset");
  const reset = await canvas.screenshot();
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

test("renderer initialization errors enter the failed state", async ({ page }) => {
  await readyGraph(page, "/graph");
  await page.evaluate(() => {
    window.dispatchEvent(new ErrorEvent("error", { error: new Error("WebGLRenderer initialization failed") }));
  });
  const surface = page.getByTestId("graph-surface");
  await expect(surface).toHaveAttribute("data-state", "failed");
  await expect(surface).toContainText("Citation graph is unavailable in this browser.");
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
