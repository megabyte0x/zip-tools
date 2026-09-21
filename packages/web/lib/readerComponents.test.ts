import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { test } from 'node:test';
import React, { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  degradedReaderFixture,
  fullReaderFixture,
  missingReaderFixture,
} from './readerFixtures.ts';
import type { ZipRecord } from './types.ts';

registerHooks({
  load(url, context, nextLoad) {
    if (url.endsWith('.css')) {
      return {
        format: 'module',
        source: 'export default new Proxy({}, { get: (_, key) => String(key) });',
        shortCircuit: true,
      };
    }
    return nextLoad(url, context);
  },
});

// The app compiles JSX with Next's automatic runtime. The lightweight tsx test
// runner uses the classic runtime, so expose React before importing components.
(globalThis as typeof globalThis & { React: typeof React }).React = React;

const components = Promise.all([
  import('../components/ReaderBody.tsx'),
  import('../components/ReaderShell.tsx'),
]);

const officialUrl = 'https://zips.z.cash/zip-0312';

const zip: ZipRecord = {
  id: 'zip-0312',
  number: 312,
  slug: 'zip-0312',
  title: 'FROST for Zcash',
  status: [{ label: 'Final' }],
  statusRaw: 'Final',
  category: 'Consensus',
  owners: [{ name: 'Fixture Owner' }],
  created: '2024-01-02',
  license: 'MIT',
  discussionsTo: null,
  nuIds: [],
  citations: [],
  citedBy: [],
  sourcePath: 'zips/zip-0312.rst',
  officialUrl,
  githubUrl: 'https://github.com/zcash/zips/blob/main/zip-0312.rst',
  bodyKind: 'md',
  body: '## Legacy section\n\nThis must not determine the prepared TOC.',
  parseWarnings: [],
};

async function renderBody(document: typeof fullReaderFixture): Promise<string> {
  const [{ ReaderBody }] = await components;
  return renderToStaticMarkup(createElement(ReaderBody, {
    body: 'Legacy body must not render.',
    bodyKind: 'md',
    officialUrl,
    document,
  }));
}

async function renderPreparedShell(): Promise<string> {
  const [{ ReaderBody }, { ReaderShell }] = await components;
  return renderToStaticMarkup(createElement(
    ReaderShell,
    { zip, prev: null, next: null, document: fullReaderFixture },
    createElement(ReaderBody, {
      body: zip.body,
      bodyKind: zip.bodyKind,
      officialUrl,
      document: fullReaderFixture,
    }),
  ));
}

function occurrences(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

test('ReaderBody renders trusted full prepared HTML', async () => {
  const html = await renderBody(fullReaderFixture);

  assert.ok(html.includes(fullReaderFixture.html));
  assert.match(html, /<table>/);
  assert.match(html, /<pre><code>const verified = true;<\/code><\/pre>/);
  assert.doesNotMatch(html, /Legacy body must not render/);
});

test('ReaderBody shows the degraded conversion notice and prepared prose', async () => {
  const html = await renderBody(degradedReaderFixture);

  assert.match(html, /role="status"/);
  assert.match(html, /Limited conversion\./);
  assert.match(html, /Full-fidelity RST conversion was unavailable\./);
  assert.ok(html.includes(degradedReaderFixture.html));
});

test('ReaderBody missing mode renders exactly one official fallback', async () => {
  const html = await renderBody(missingReaderFixture);

  assert.equal(occurrences(html, 'Open on zips.z.cash'), 1);
  assert.equal(occurrences(html, `href="${officialUrl}"`), 1);
  assert.doesNotMatch(html, /Legacy body must not render/);
});

test('ReaderShell selects fixture document.toc instead of legacy body headings', async () => {
  const html = await renderPreparedShell();

  assert.equal(occurrences(html, 'href="#intro"'), 2);
  assert.equal(occurrences(html, 'href="#security"'), 2);
  assert.doesNotMatch(html, /href="#legacy-section"/);
});

test('ReaderShell TOC links agree with ReaderBody prepared HTML targets', async () => {
  const html = await renderPreparedShell();

  for (const heading of fullReaderFixture.toc) {
    assert.equal(occurrences(html, `href="#${heading.id}"`), 2);
    assert.equal(occurrences(html, `id="${heading.id}"`), 1);
  }
});
