import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  degradedReaderFixture,
  fullReaderFixture,
  missingReaderFixture,
} from './readerFixtures';
import type {
  BodyFormat,
  ExplorerQuery,
  GraphInput,
  PreparedReader,
  ReaderHeading,
} from './workbenchContracts';
import type { ZipRecord } from './types';

const bodyFormats: BodyFormat[] = ['html', 'markdown', 'rst-source', 'none'];
const headings: ReaderHeading[] = fullReaderFixture.toc;
const preparedReaders: PreparedReader[] = [
  fullReaderFixture,
  degradedReaderFixture,
  missingReaderFixture,
];
const explorerQuery: ExplorerQuery = {
  text: '',
  kind: '',
  status: '',
  nuId: '',
  category: '',
  sort: 'number',
};
const graphInput: GraphInput = {
  zips: [] as ZipRecord[],
  dangling: [],
  variant: 'home',
};

void bodyFormats;
void headings;
void preparedReaders;
void explorerQuery;
void graphInput;

test('reader fixture anchors and TOC agree', () => {
  for (const heading of fullReaderFixture.toc) {
    assert.ok(fullReaderFixture.html.includes(`id="${heading.id}"`));
  }
  assert.equal(fullReaderFixture.mode, 'full');
});

test('reader fixtures freeze full, degraded, and missing modes', () => {
  assert.match(fullReaderFixture.html, /<p[ >]/);
  assert.match(fullReaderFixture.html, /<table[ >]/);
  assert.match(fullReaderFixture.html, /<pre[ >]/);
  assert.deepEqual(
    fullReaderFixture.toc.map(({ id }) => id),
    ['intro', 'security'],
  );

  assert.equal(degradedReaderFixture.mode, 'degraded');
  assert.deepEqual(degradedReaderFixture.toc, fullReaderFixture.toc);
  assert.ok(degradedReaderFixture.warnings.length > 0);

  assert.equal(missingReaderFixture.mode, 'missing');
  assert.equal(missingReaderFixture.html, '');
  assert.deepEqual(missingReaderFixture.toc, []);
});
