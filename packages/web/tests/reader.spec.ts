import { expect, test } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  degradedReaderFixture,
  fullReaderFixture,
} from '../lib/readerFixtures';

const officialUrl = 'https://zips.z.cash/zip-0312';
const webRoot = fileURLToPath(new URL('..', import.meta.url));

const fixtureRenderScript = String.raw`
import { registerHooks } from 'node:module';
import React, { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  degradedReaderFixture,
  fullReaderFixture,
  missingReaderFixture,
} from './lib/readerFixtures.ts';

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

globalThis.React = React;

void (async () => {
  const [{ ReaderBody }, { ReaderShell }] = await Promise.all([
    import('./components/ReaderBody.tsx'),
    import('./components/ReaderShell.tsx'),
  ]);
  const officialUrl = 'https://zips.z.cash/zip-0312';
  const zip = {
    id: 'zip-0312', number: 312, slug: 'zip-0312', title: 'FROST for Zcash',
    status: [{ label: 'Final' }], statusRaw: 'Final', category: 'Consensus',
    owners: [{ name: 'Fixture Owner' }], created: '2024-01-02', license: 'MIT',
    discussionsTo: null, nuIds: [], citations: [], citedBy: [],
    sourcePath: 'zips/zip-0312.rst', officialUrl,
    githubUrl: 'https://github.com/zcash/zips/blob/main/zip-0312.rst',
    bodyKind: 'md',
    body: '## Legacy section\\n\\nThis must not determine the prepared TOC.',
    parseWarnings: [],
  };
  const renderBody = (document) => renderToStaticMarkup(createElement(ReaderBody, {
    body: 'Legacy body must not render.', bodyKind: 'md', officialUrl, document,
  }));
  const shell = renderToStaticMarkup(createElement(
    ReaderShell,
    { zip, prev: null, next: null, document: fullReaderFixture },
    createElement(ReaderBody, {
      body: zip.body, bodyKind: zip.bodyKind, officialUrl, document: fullReaderFixture,
    }),
  ));
  console.log(JSON.stringify({
    full: renderBody(fullReaderFixture),
    degraded: renderBody(degradedReaderFixture),
    missing: renderBody(missingReaderFixture),
    shell,
  }));
})();
`;

type FixtureMarkup = {
  full: string;
  degraded: string;
  missing: string;
  shell: string;
};

let fixtureMarkup: FixtureMarkup | undefined;

function renderedFixtures(): FixtureMarkup {
  fixtureMarkup ??= JSON.parse(execFileSync(
    process.execPath,
    ['--import', 'tsx', '--eval', fixtureRenderScript],
    { cwd: webRoot, encoding: 'utf8' },
  )) as FixtureMarkup;
  return fixtureMarkup;
}

function occurrences(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

test('prepared fixture renders trusted full HTML', () => {
  const html = renderedFixtures().full;

  expect(html).toContain(fullReaderFixture.html);
  expect(html).toMatch(/<table>/);
  expect(html).toMatch(/<pre><code>const verified = true;<\/code><\/pre>/);
  expect(html).not.toContain('Legacy body must not render.');
});

test('degraded fixture renders its notice and prepared prose', () => {
  const html = renderedFixtures().degraded;

  expect(html).toMatch(/role="status"/);
  expect(html).toContain('Limited conversion.');
  expect(html).toContain('Full-fidelity RST conversion was unavailable.');
  expect(html).toContain(degradedReaderFixture.html);
});

test('missing fixture renders exactly one official fallback', () => {
  const html = renderedFixtures().missing;

  expect(occurrences(html, 'Open on zips.z.cash')).toBe(1);
  expect(occurrences(html, `href="${officialUrl}"`)).toBe(1);
  expect(html).not.toContain('Legacy body must not render.');
});

test('prepared fixture TOC replaces legacy body headings', () => {
  const html = renderedFixtures().shell;

  expect(occurrences(html, 'href="#intro"')).toBe(2);
  expect(occurrences(html, 'href="#security"')).toBe(2);
  expect(html).not.toContain('href="#legacy-section"');
});

test('prepared fixture TOC links agree with body targets', () => {
  const html = renderedFixtures().shell;

  for (const heading of fullReaderFixture.toc) {
    expect(occurrences(html, `href="#${heading.id}"`)).toBe(2);
    expect(occurrences(html, `id="${heading.id}"`)).toBe(1);
  }
});

test('previous and next ZIP links expose their destinations', async ({ page }) => {
  await page.goto('/zip/312');

  await expect(page.getByRole('link', { name: /Previous ZIP \d+:/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /Next ZIP \d+:/ })).toBeVisible();
});

test('reader shows ZIP identity and title', async ({ page }) => {
  await page.goto('/zip/312');

  await expect(page.getByText('ZIP 312', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('FROST');
});

test('ZIP 312 exposes its prepared proposal paragraphs', async ({ page }) => {
  await page.goto('/zip/312');

  const body = page.getByTestId('reader-body');
  await expect(body).toBeVisible();
  expect((await body.innerText()).trim().length).toBeGreaterThan(200);
});

test('reader body identifies its surface', async ({ page }) => {
  await page.goto('/zip/312');

  await expect(page.getByTestId('reader-body')).toBeVisible();
});

test('desktop article keeps a readable measure', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/zip/312');

  const width = await page.locator('article').evaluate((node) => node.getBoundingClientRect().width);
  expect(width).toBeLessThanOrEqual(800);
});

test('TOC links resolve to article headings and preserve hash history', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/zip/48');

  const contents = page.getByRole('navigation', { name: 'Contents' });
  const links = contents.getByRole('link');
  await expect(links.first()).toBeVisible();
  const firstHash = await links.first().getAttribute('href');
  const secondHash = await links.nth(1).getAttribute('href');
  expect(firstHash).toMatch(/^#[^#]+/);
  expect(secondHash).toMatch(/^#[^#]+/);
  await expect(page.locator(firstHash!)).toHaveCount(1);
  await expect(page.locator(secondHash!)).toHaveCount(1);

  await links.first().click();
  await links.nth(1).click();
  await page.goBack();
  expect(new URL(page.url()).hash).toBe(firstHash);
});

test('mobile metadata is a closed disclosure after the title', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/zip/312');

  const title = page.getByRole('heading', { level: 1 });
  const metadata = page.getByText('Proposal metadata', { exact: true });
  await expect(metadata).toBeVisible();
  const disclosure = metadata.locator('xpath=..');
  await expect(disclosure).not.toHaveAttribute('open', '');
  expect(await title.evaluate((node) =>
    Boolean(node.compareDocumentPosition(document.querySelector('summary')!) & Node.DOCUMENT_POSITION_FOLLOWING),
  )).toBe(true);

  await metadata.click();
  await expect(page.getByRole('link', { name: 'Official' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'GitHub' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
