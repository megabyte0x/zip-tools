import type { ZipRecord } from './types';

export type BodyFormat = 'html' | 'markdown' | 'rst-source' | 'none';

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
  zips: ZipRecord[]; // Caller supplies body: null; never serialize article bodies.
  dangling: number[];
  variant: 'home' | 'graph';
};
