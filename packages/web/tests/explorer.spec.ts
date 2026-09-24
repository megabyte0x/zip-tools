import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import ts from "typescript";

const require = createRequire(import.meta.url);

const expectedReleasedRouteErrors = new Set([
  "route.continue: Route is already handled!",
  "route.continue: Target page, context or browser has been closed",
]);

declare global {
  interface Window {
    React: { createElement(component: unknown, props: unknown): unknown };
    ReactDOM: { createRoot(container: Element | null): { render(node: unknown): void } };
    ZipExplorer: unknown;
  }
}

type ReleasedRouteSettlement =
  | { outcome: "continued" }
  | { outcome: "cancelled"; message: string };

async function classifyReleasedRoute(
  continueRoute: () => Promise<void>,
): Promise<ReleasedRouteSettlement> {
  try {
    await continueRoute();
    return { outcome: "continued" };
  } catch (error) {
    if (error instanceof Error && expectedReleasedRouteErrors.has(error.message)) {
      return { outcome: "cancelled", message: error.message };
    }
    throw error;
  }
}

async function mountZipExplorer(
  page: Page,
  props: Record<string, unknown>,
  url: string,
) {
  await page.goto(url);
  await page.evaluate(() => {
    document.body.replaceChildren(document.createElement("main"));
  });

  const reactRoot = dirname(require.resolve("react/package.json"));
  const reactDomRoot = dirname(require.resolve("react-dom/package.json"));
  await page.addScriptTag({ path: resolve(reactRoot, "umd/react.development.js") });
  await page.addScriptTag({ path: resolve(reactDomRoot, "umd/react-dom.development.js") });

  const source = readFileSync(resolve(process.cwd(), "components/ZipExplorer.tsx"), "utf8")
    .replace(/^"use client";\s*/m, "")
    .replace(/^import .*;\s*$/gm, "")
    .replace("export function ZipExplorer", "function ZipExplorer");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { jsx: ts.JsxEmit.React, module: ts.ModuleKind.None, target: ts.ScriptTarget.ES2022 },
  }).outputText;

  await page.addScriptTag({
    content: `
      const { useEffect, useMemo, useRef, useState, useTransition } = React;
      const useRouter = () => ({ push() {} });
      const styles = new Proxy({}, { get: (_, key) => String(key) });
      const filterZips = (zips) => zips;
      const parseZipsQuery = (search) => {
        const params = new URLSearchParams(search);
        const kind = params.get("kind") || "";
        return {
          text: params.get("q") || "",
          kind: kind === "draft" || kind === "numbered" ? kind : "",
          status: params.get("status") || "",
          nuId: params.get("nu") || "",
          category: params.get("category") || "",
          sort: params.get("sort") === "title" ? "title" : "number",
        };
      };
      const serializeZipsQuery = (_query, existing) => existing;
      const SearchBand = (props) => React.createElement(
        "output",
        { "data-testid": "mounted-query" },
        JSON.stringify({
          text: props.text,
          kind: props.kind,
          status: props.status,
          nuId: props.nuId,
          category: props.category,
          sort: props.sort,
        }),
      );
      const ZipTable = () => React.createElement("div");
      ${compiled}
      window.ZipExplorer = ZipExplorer;
    `,
  });
  await page.evaluate((componentProps) => {
    const root = window.ReactDOM.createRoot(document.querySelector("main"));
    root.render(window.React.createElement(window.ZipExplorer, componentProps));
  }, { zips: [], ...props });
}

async function openFilteredExplorerFromReader(page: Page) {
  await page.goto("/zip/312");
  await page.getByRole("link", { name: "Browse" }).click();
  const search = page.getByRole("searchbox", { name: "Search", exact: true });
  await search.fill("317");
  await expect(page).toHaveURL(/\/zips\?q=317$/);
  await page.getByLabel("Kind", { exact: true }).selectOption("numbered");
  await expect(page).toHaveURL(/\/zips\?q=317&kind=numbered$/);
}

test("released route settlement rejects unexpected continuation failures", async () => {
  const failure = new Error("injected unexpected route failure");

  await expect(classifyReleasedRoute(() => Promise.reject(failure))).rejects.toBe(failure);
});

test("mount initialization keeps supplied props unless explorer URL keys are present", async ({ page }) => {
  const supplied = {
    text: "Orchard",
    kind: "numbered",
    status: "Active",
    nuId: "nu6.3",
    category: "Consensus",
    sort: "title",
  };

  await mountZipExplorer(page, { initialQuery: supplied }, "/zips?keep=1");
  await expect(page.getByTestId("mounted-query")).toHaveText(JSON.stringify(supplied));

  await mountZipExplorer(
    page,
    { initialText: "Orchard", initialKind: "numbered" },
    "/zips?keep=1",
  );
  await expect(page.getByTestId("mounted-query")).toHaveText(
    JSON.stringify({ ...supplied, status: "", nuId: "", category: "", sort: "number" }),
  );

  await mountZipExplorer(page, { initialQuery: supplied }, "/zips?q=Halo&kind=draft");
  await expect(page.getByTestId("mounted-query")).toHaveText(
    JSON.stringify({ text: "Halo", kind: "draft", status: "", nuId: "", category: "", sort: "number" }),
  );
});

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

test("Back during a pending client transition restores the exact filtered explorer", async ({ page }) => {
  let signalPendingRequest!: () => void;
  const pendingRequest = new Promise<void>((resolve) => {
    signalPendingRequest = resolve;
  });
  let releaseResponse!: () => void;
  const responseGate = new Promise<void>((resolve) => {
    releaseResponse = resolve;
  });
  let signalReleasedRequestSettled!: (settlement: ReleasedRouteSettlement) => void;
  let failReleasedRequestSettlement!: (error: unknown) => void;
  const releasedRequestSettled = new Promise<ReleasedRouteSettlement>((resolve, reject) => {
    signalReleasedRequestSettled = resolve;
    failReleasedRequestSettlement = reject;
  });

  await page.route(/\/zip\/317(?:\?|$)/, async (route) => {
    if (route.request().headers().rsc !== "1") {
      await route.continue();
      return;
    }
    signalPendingRequest();
    await responseGate;
    try {
      signalReleasedRequestSettled(await classifyReleasedRoute(() => route.continue()));
    } catch (error) {
      failReleasedRequestSettlement(error);
      throw error;
    }
  });

  await openFilteredExplorerFromReader(page);
  await page.getByText("Revision details", { exact: true }).first().click();
  await expect(
    page.getByText("[Revision 0] Active, [Revision 1: NU6.3] Draft, [Revision 2] Draft"),
  ).toBeVisible();

  await Promise.all([
    pendingRequest,
    page
      .getByRole("link", { name: "Proportional Transfer Fee Mechanism" })
      .click({ noWaitAfter: true }),
  ]);
  await page.evaluate(() => history.back());
  await expect(page.getByRole("region", { name: "ZIP explorer" })).toHaveAttribute(
    "aria-busy",
    "false",
  );
  await expect(page).toHaveURL(/\/zips\?q=317&kind=numbered$/);
  await expect(page.getByRole("searchbox", { name: "Search", exact: true })).toHaveValue("317");
  await expect(page.getByLabel("Kind", { exact: true })).toHaveValue("numbered");
  releaseResponse();
  const releasedRequestSettlement = await releasedRequestSettled;
  if (releasedRequestSettlement.outcome === "cancelled") {
    expect(expectedReleasedRouteErrors.has(releasedRequestSettlement.message)).toBe(true);
  } else {
    expect(releasedRequestSettlement).toEqual({ outcome: "continued" });
  }

  await expect(page).toHaveURL(/\/zips\?q=317&kind=numbered$/);
  await expect(page.getByRole("region", { name: "ZIP explorer" })).toHaveAttribute(
    "aria-busy",
    "false",
  );
  await expect(page.getByRole("searchbox", { name: "Search", exact: true })).toHaveValue("317");
  await expect(page.getByLabel("Kind", { exact: true })).toHaveValue("numbered");
  await expect(
    page.getByRole("heading", { name: "Proportional Transfer Fee Mechanism" }),
  ).toHaveCount(0);

  await page.goForward({ waitUntil: "commit" });
  await expect(page).toHaveURL(/\/zips\?q=317&kind=numbered$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/zips\?q=317$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/zip\/312$/);
});

test("ordinary and keyboard result activation stay client-side without duplicate history", async ({ page }) => {
  await openFilteredExplorerFromReader(page);
  const explorerHistoryLength = await page.evaluate(() => history.length);
  const marker = await page.evaluate(() => {
    const value = crypto.randomUUID();
    (window as Window & { __explorerSession?: string }).__explorerSession = value;
    return value;
  });
  const result = page.getByRole("link", { name: "Proportional Transfer Fee Mechanism" });

  await result.click();
  await expect(page).toHaveURL(/\/zip\/317$/);
  expect(await page.evaluate(() => history.length)).toBe(explorerHistoryLength + 1);
  expect(
    await page.evaluate(
      () => (window as Window & { __explorerSession?: string }).__explorerSession,
    ),
  ).toBe(marker);
  await page.goBack();
  await expect(page).toHaveURL(/\/zips\?q=317&kind=numbered$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/zips\?q=317$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/zip\/312$/);

  await page.goto("/zips?q=317&kind=numbered");
  const keyboardSearch = page.getByRole("searchbox", { name: "Search", exact: true });
  await keyboardSearch.fill("317x");
  await expect(page).toHaveURL(/\/zips\?q=317x&kind=numbered$/);
  await keyboardSearch.fill("317");
  await expect(page).toHaveURL(/\/zips\?q=317&kind=numbered$/);
  const keyboardMarker = await page.evaluate(() => {
    const value = crypto.randomUUID();
    (window as Window & { __explorerSession?: string }).__explorerSession = value;
    return value;
  });
  await result.focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/zip\/317$/);
  expect(
    await page.evaluate(
      () => (window as Window & { __explorerSession?: string }).__explorerSession,
    ),
  ).toBe(keyboardMarker);
});

test("failed result transition leaves no pending or history residue", async ({ page }) => {
  let signalFailedRequest!: () => void;
  const failedRequest = new Promise<void>((resolve) => {
    signalFailedRequest = resolve;
  });

  await page.route(/\/zip\/317(?:\?|$)/, async (route) => {
    if (route.request().headers().rsc !== "1") {
      await route.continue();
      return;
    }
    signalFailedRequest();
    await route.abort("failed");
  });

  await openFilteredExplorerFromReader(page);
  await Promise.all([
    failedRequest,
    page
      .getByRole("link", { name: "Proportional Transfer Fee Mechanism" })
      .click({ noWaitAfter: true }),
  ]);

  await expect(page).toHaveURL(/\/zip\/317$/);
  await expect(
    page.getByRole("heading", { name: "Proportional Transfer Fee Mechanism" }),
  ).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/\/zips\?q=317&kind=numbered$/);
  await expect(page.getByRole("searchbox", { name: "Search", exact: true })).toHaveValue("317");
  await page.goBack();
  await expect(page).toHaveURL(/\/zips\?q=317$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/zip\/312$/);
});

for (const activation of ["double pointer", "repeated Enter"] as const) {
  test(`${activation} result activation is idempotent`, async ({ page }) => {
    let signalPendingRequest!: () => void;
    const pendingRequest = new Promise<void>((resolve) => {
      signalPendingRequest = resolve;
    });
    let releaseResponse!: () => void;
    const responseGate = new Promise<void>((resolve) => {
      releaseResponse = resolve;
    });

    await page.route(/\/zip\/317(?:\?|$)/, async (route) => {
      if (route.request().headers().rsc !== "1") {
        await route.continue();
        return;
      }
      signalPendingRequest();
      await responseGate;
      await route.continue().catch(() => {});
    });

    await openFilteredExplorerFromReader(page);
    const result = page.getByRole("link", { name: "Proportional Transfer Fee Mechanism" });
    if (activation === "double pointer") {
      await result.click({ clickCount: 2, noWaitAfter: true });
    } else {
      await result.focus();
      await page.keyboard.press("Enter");
      await page.keyboard.press("Enter");
    }
    await pendingRequest;
    releaseResponse();

    await expect(page).toHaveURL(/\/zip\/317$/);
    await page.goBack();
    await expect(page).toHaveURL(/\/zips\?q=317&kind=numbered$/);
    await page.goBack();
    await expect(page).toHaveURL(/\/zips\?q=317$/);
    await page.goBack();
    await expect(page).toHaveURL(/\/zip\/312$/);
  });
}

test("descendant preventDefault cancels result navigation without history residue", async ({ page }) => {
  await openFilteredExplorerFromReader(page);
  const explorerUrl = page.url();
  const historyLength = await page.evaluate(() => history.length);
  const result = page.getByRole("link", { name: "Proportional Transfer Fee Mechanism" });

  await result.evaluate((link) => {
    const child = document.createElement("span");
    child.textContent = link.textContent;
    child.dataset.preventingChild = "true";
    child.addEventListener("click", (event) => event.preventDefault());
    link.replaceChildren(child);
  });
  await page.locator('[data-preventing-child="true"]').click();

  expect(page.url()).toBe(explorerUrl);
  expect(await page.evaluate(() => history.length)).toBe(historyLength);
});

test("modified result clicks retain browser semantics without staging history", async ({ page, context }) => {
  await openFilteredExplorerFromReader(page);
  const explorerUrl = page.url();
  const historyLength = await page.evaluate(() => history.length);
  const popupPromise = context.waitForEvent("page");

  await page
    .getByRole("link", { name: "Proportional Transfer Fee Mechanism" })
    .click({ modifiers: ["Control"] });
  const popup = await popupPromise;
  await popup.waitForLoadState("domcontentloaded");

  expect(page.url()).toBe(explorerUrl);
  expect(await page.evaluate(() => history.length)).toBe(historyLength);
  await expect(popup).toHaveURL(/\/zip\/317$/);
  await popup.close();
});

test("debounce replaces, discrete filters push, and popstate restores controls", async ({ page }) => {
  await page.goto("/zip/312");
  await page.goto("/zips");
  const initialLength = await page.evaluate(() => history.length);
  const search = page.getByRole("searchbox", { name: "Search", exact: true });

  await search.fill("Orchard");
  await expect(page).toHaveURL(/\/zips\?q=Orchard$/);
  expect(await page.evaluate(() => history.length)).toBe(initialLength);

  await page.getByLabel("Kind", { exact: true }).selectOption("numbered");
  await expect(page).toHaveURL(/\/zips\?q=Orchard&kind=numbered$/);
  expect(await page.evaluate(() => history.length)).toBe(initialLength + 1);

  await page.goBack();
  await expect(page).toHaveURL(/\/zips\?q=Orchard$/);
  await expect(search).toHaveValue("Orchard");
  await expect(page.getByLabel("Kind", { exact: true })).toHaveValue("");
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

  await expect(page.getByRole("columnheader")).toHaveCount(5);
  expect(
    await page.locator("tbody tr").first().locator("td").evaluateAll((cells) =>
      cells.map((cell) => {
        const header = document.getElementById(cell.getAttribute("headers") ?? "");
        return header?.textContent?.trim() ?? "";
      }),
    ),
  ).toEqual(["Number", "Title", "Status", "Category", "NU"]);

  await page.getByText("Revision details", { exact: true }).first().click();
  await expect(
    page.getByText("[Revision 0] Active, [Revision 1: NU6.3] Draft, [Revision 2] Draft"),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    ),
  ).toBe(true);
});
