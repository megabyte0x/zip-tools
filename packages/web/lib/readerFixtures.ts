import type { PreparedReader, ReaderHeading } from './workbenchContracts';

const fixtureToc: ReaderHeading[] = [
  { id: 'intro', text: 'Introduction', level: 2 },
  { id: 'security', text: 'Security considerations', level: 3 },
];

export const fullReaderFixture: PreparedReader = {
  html: [
    '<h2 id="intro">Introduction</h2>',
    '<p>This proposal fixture demonstrates complete prepared reader content.</p>',
    '<table><thead><tr><th>Field</th><th>Value</th></tr></thead><tbody><tr><td>Mode</td><td>Full</td></tr></tbody></table>',
    '<pre><code>const verified = true;</code></pre>',
    '<h3 id="security">Security considerations</h3>',
    '<p>Prepared HTML is sanitized before it reaches the reader surface.</p>',
  ].join(''),
  toc: fixtureToc,
  mode: 'full',
  warnings: [],
};

export const degradedReaderFixture: PreparedReader = {
  html: [
    '<h2 id="intro">Introduction</h2>',
    '<p>This source is shown using the limited RST fallback.</p>',
    '<h3 id="security">Security considerations</h3>',
    '<p>Unsupported source formatting may be omitted.</p>',
  ].join(''),
  toc: fixtureToc,
  mode: 'degraded',
  warnings: ['Full-fidelity RST conversion was unavailable.'],
};

export const missingReaderFixture: PreparedReader = {
  html: '',
  toc: [],
  mode: 'missing',
  warnings: [],
};
