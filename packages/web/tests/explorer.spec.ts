import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import ts from "typescript";

const require = createRequire(import.meta.url);

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
      const { useEffect, useMemo, useRef, useState } = React;
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
