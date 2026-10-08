import type { BrowserZip } from './browserZip';

export type { BodyFormat } from './types';

export type ReaderHeading = {
  id: string;
  text: string;
  level: 2 | 3;
};

export type PreparedReader = {
  html: string;
  toc: ReaderHeading[];
  mode: 'full' | 'degraded' | 'missing';
  warnings: string[];
};

export type ExplorerQuery = {
  text: string;
  kind: '' | 'draft' | 'numbered';
  status: string;
  nuId: string;
  category: string;
  sort: 'number' | 'title';
  page: number;
};

export type GraphInput = {
  zips: BrowserZip[];
  dangling: number[];
  variant: 'home' | 'graph';
};
