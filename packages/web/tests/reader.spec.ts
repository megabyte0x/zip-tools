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
  const issueSource = {
    kind: 'github-issue', url: 'https://github.com/zcash/zips/issues/1302',
    title: 'Issue #1302 fixture', updatedAt: '2026-07-05T21:00:43Z',
    fetchedAt: '2026-09-23T00:00:00Z', contentHash: 'a'.repeat(64),
  };
  const issueDocument = {
    html: '<h2 id="motivation">Motivation</h2><p>Issue fixture body is rendered from the snapshot.</p>',
    toc: [{ id: 'motivation', text: 'Motivation', level: 2 }], mode: 'full', warnings: [],
  };
  const issueZip = {
    ...zip, status: [{ label: 'Reserved' }], statusRaw: 'Reserved', bodySource: issueSource,
  };
  const issue = renderToStaticMarkup(createElement(ReaderBody, {
    body: 'Legacy body must not render.', bodyKind: 'md', officialUrl, bodySource: issueSource,
    discussionsTo: issueSource.url, document: issueDocument,
  }));
  const legacyIssue = renderToStaticMarkup(createElement(ReaderBody, {
    body: 'Legacy issue fixture body.', bodyKind: 'md', officialUrl, bodySource: issueSource,
    discussionsTo: issueSource.url,
  }));
  const missingWithDiscussion = renderToStaticMarkup(createElement(ReaderBody, {
    body: null, bodyKind: 'none', officialUrl, bodySource: { kind: 'none' },
    discussionsTo: issueSource.url, document: missingReaderFixture,
  }));
  const issueShell = renderToStaticMarkup(createElement(
    ReaderShell,
    { zip: issueZip, prev: null, next: null, document: issueDocument },
    createElement(ReaderBody, {
      body: issueZip.body, bodyKind: issueZip.bodyKind, officialUrl, bodySource: issueSource,
      discussionsTo: issueZip.discussionsTo, document: issueDocument,
    }),
  ));
  console.log(JSON.stringify({
    full: renderBody(fullReaderFixture),
    degraded: renderBody(degradedReaderFixture),
    missing: renderBody(missingReaderFixture),
    shell,
    issue,
    legacyIssue,
    missingWithDiscussion,
    issueShell,
  }));
})();
`;

type FixtureMarkup = {
  full: string;
  degraded: string;
  missing: string;
  shell: string;
  issue: string;
  legacyIssue: string;
  missingWithDiscussion: string;
  issueShell: string;
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

  expect(html).toContain('No proposal body is available in this snapshot.');
  expect(occurrences(html, 'Open on zips.z.cash')).toBe(1);
  expect(occurrences(html, `href="${officialUrl}"`)).toBe(1);
  expect(html).not.toContain('Read the linked GitHub issue');
  expect(html).not.toContain('Legacy body must not render.');
});

test('issue-backed fixtures render their saved body without a provenance callout', () => {
  const { issue, legacyIssue, issueShell } = renderedFixtures();
  const notice = 'No proposal body is present in this ZIP snapshot. Showing the linked GitHub issue description.';
  const issueUrl = 'https://github.com/zcash/zips/issues/1302';

  for (const html of [issue, legacyIssue]) {
    expect(occurrences(html, 'data-testid="issue-body-notice"')).toBe(0);
    expect(html).not.toContain(notice);
    expect(html).not.toContain('Issue #1302 fixture');
    expect(occurrences(html, `href="${issueUrl}"`)).toBe(0);
    expect(html).not.toContain('dateTime="2026-07-05T21:00:43Z"');
    expect(html).not.toContain('dateTime="2026-09-23T00:00:00Z"');
  }
  expect(issue).toContain('Issue fixture body is rendered from the snapshot.');
  expect(issue).not.toContain('Legacy body must not render.');
  expect(legacyIssue).toContain('Legacy issue fixture body.');
  expect(issueShell).toContain('Reserved');
});

test('missing-with-discussion fixture renders one issue link and one official fallback', () => {
  const html = renderedFixtures().missingWithDiscussion;
  const issueUrl = 'https://github.com/zcash/zips/issues/1302';

  expect(html).toContain('No proposal body is available in this snapshot.');
  expect(html).toContain('Read the linked GitHub issue');
  expect(occurrences(html, `href="${issueUrl}"`)).toBe(1);
  expect(occurrences(html, 'Open on zips.z.cash')).toBe(1);
  expect(occurrences(html, `href="${officialUrl}"`)).toBe(1);
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

test('closed generated summary does not request optional AI', async ({ page }) => {
  const summaryRequests: string[] = [];
  const unavailableResponses: number[] = [];
  const consoleErrors: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('/api/summary/')) summaryRequests.push(request.url());
  });
  page.on('response', (response) => {
    if (response.url().includes('/api/summary/') && response.status() === 503) {
      unavailableResponses.push(response.status());
    }
  });
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });

  await page.goto('/zip/48');
  await expect(page.getByText('Generated summary', { exact: true }).locator('..')).not.toHaveAttribute('open', '');
  await page.waitForTimeout(500);

  expect(summaryRequests).toEqual([]);
  expect(unavailableResponses).toEqual([]);
  expect(consoleErrors.filter((message) => message.includes('503'))).toEqual([]);
});

test('generated summary fetches only after opening and retries without serializing the body', async ({ page }) => {
  const summaryRequests: Array<{ method: string; postData: string | null }> = [];
  page.on('request', (request) => {
    if (request.url().includes('/api/summary/')) {
      summaryRequests.push({ method: request.method(), postData: request.postData() });
    }
  });

  await page.goto('/zip/48');
  await page.getByText('Generated summary', { exact: true }).click();
  await expect(page.getByText('Summary is unavailable.', { exact: true })).toBeVisible();
  await expect.poll(() => summaryRequests.length).toBe(1);
  expect(summaryRequests[0]).toEqual({ method: 'GET', postData: null });

  await page.getByRole('button', { name: 'Retry' }).click();
  await expect.poll(() => summaryRequests.length).toBe(2);
  expect(summaryRequests[1]).toEqual({ method: 'GET', postData: null });
});

test('generated summary stays single-flight across a close and reopen, then retries after failure', async ({ page }) => {
  let requests = 0;
  let releaseFirstResponse!: () => void;
  const firstResponsePending = new Promise<void>((resolve) => {
    releaseFirstResponse = resolve;
  });
  await page.route('**/api/summary/48', async (route) => {
    requests += 1;
    if (requests === 1) await firstResponsePending;
    await route.fulfill({ status: 503, body: 'unavailable' });
  });

  await page.goto('/zip/48');
  const title = page.getByText('Generated summary', { exact: true });
  const disclosure = title.locator('..');
  await title.click();
  await expect.poll(() => requests).toBe(1);

  await title.click();
  await expect(disclosure).not.toHaveAttribute('open', '');
  await title.click();
  await expect(disclosure).toHaveAttribute('open', '');
  await page.waitForTimeout(100);
  expect(requests).toBe(1);

  releaseFirstResponse();
  await expect(page.getByText('Summary is unavailable.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Retry' }).click();
  await expect.poll(() => requests).toBe(2);
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

for (const width of [390, 1280]) {
  test(`ZIP 317 scopes horizontal scrolling to its structured formula at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/zip/317');

    const formula = page.locator('p').filter({
      has: page.locator('math').filter({ hasText: 'unpaid_actions(tx)' }),
    }).first();
    const inlineMath = page.locator('p').filter({
      has: page.locator('math').filter({ hasText: 'conventional_fee(tx)' }),
    }).first();
    await expect(formula).toBeVisible();
    await expect(inlineMath).toBeVisible();

    const layout = await formula.evaluate((node) => {
      const article = node.closest('article')!;
      const metadata = article.nextElementSibling;
      return {
        documentContained:
          document.documentElement.scrollWidth <= document.documentElement.clientWidth,
        formulaOverflows: node.scrollWidth > node.clientWidth,
        overflowX: getComputedStyle(node).overflowX,
        formulaRight: node.getBoundingClientRect().right,
        articleRight: article.getBoundingClientRect().right,
        metadataLeft: metadata?.getBoundingClientRect().left ?? null,
      };
    });
    const inlineMathOverflow = await inlineMath.evaluate(
      (node) => getComputedStyle(node).overflowX,
    );

    expect(layout.documentContained).toBe(true);
    expect(layout.formulaOverflows).toBe(true);
    expect(layout.overflowX).toMatch(/^(auto|scroll)$/);
    expect(layout.formulaRight).toBeLessThanOrEqual(layout.articleRight);
    if (width >= 768) expect(layout.formulaRight).toBeLessThan(layout.metadataLeft!);
    expect(inlineMathOverflow).toBe('visible');
  });
}

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
  await expect(disclosure.getByRole('link', { name: 'Official', exact: true })).toBeVisible();
  await expect(disclosure.getByRole('link', { name: 'GitHub', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('reader body restores prose spacing and list markers under the CSS reset', async ({ page }) => {
  await page.goto('/draft/draft-ecc-authenticated-reply-addrs');

  const body = page.getByTestId('reader-body');
  const style = await body.evaluate((node) => {
    const list = node.querySelector('ul');
    const nested = node.querySelector('ul ul');
    const paragraph = node.querySelector('p');
    if (!list || !nested || !paragraph) throw new Error('fixture lost its lists');
    return {
      listStyle: getComputedStyle(list).listStyleType,
      listPadding: Number.parseFloat(getComputedStyle(list).paddingLeft),
      nestedStyle: getComputedStyle(nested).listStyleType,
      paragraphGap: Number.parseFloat(getComputedStyle(paragraph).marginBottom),
    };
  });
  expect(style.listStyle).toBe('disc');
  expect(style.listPadding).toBeGreaterThan(8);
  expect(style.nestedStyle).toBe('circle');
  expect(style.paragraphGap).toBeGreaterThan(8);
});

test('owner emails are not printed in the metadata sidebar', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/draft/draft-ecc-authenticated-reply-addrs');

  const sidebar = page.locator('aside');
  await expect(sidebar.getByText('Jack Grigg', { exact: true })).toBeVisible();
  expect(await sidebar.innerText()).not.toMatch(/@|<[^>]+>/);
});
