import type { ZipRecord } from "./types.ts";

export function makeZip(overrides: Partial<ZipRecord> = {}): ZipRecord {
  return {
    id: "zip-0001",
    number: 1,
    slug: "zip-0001",
    title: "Example ZIP",
    status: [{ label: "Draft" }],
    statusRaw: "Draft",
    category: "Standards Track",
    owners: [{ name: "Alice" }],
    created: null,
    license: null,
    discussionsTo: null,
    nuIds: [],
    citations: [],
    citedBy: [],
    sourcePath: "zips/zip-0001.rst",
    officialUrl: "https://zips.z.cash/zip-0001",
    githubUrl: "",
    bodyKind: "none",
    body: null,
    parseWarnings: [],
    ...overrides,
  };
}
