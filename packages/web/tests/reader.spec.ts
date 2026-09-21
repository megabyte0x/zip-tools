import { expect, test } from '@playwright/test';

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

test.fixme('ZIP 312 exposes its prepared proposal paragraphs', async ({ page }) => {
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
