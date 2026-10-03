import { registerHooks } from "node:module";
import assert from "node:assert/strict";
import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { test } from "node:test";

globalThis.React = React;

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

test("reader HTML without a prepared document omits script elements", async () => {
  const { ReaderBody } = await import("../components/ReaderBody.tsx");
  const html = renderToStaticMarkup(
    createElement(ReaderBody, {
      body: "<p>Visible</p><script>alert(1)</script>",
      bodyKind: "rst",
      officialUrl: "https://zips.z.cash/zip-0032",
    }),
  );
  assert.equal(html.includes("<script"), false);
  assert.match(html, /Visible/);
});
