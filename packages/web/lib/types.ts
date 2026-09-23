export type StatusEntry = {
  label: string;
  revision?: string;
  nuHint?: string;
};

export type Owner = { name: string; email?: string };

export type BodyFormat = "html" | "markdown" | "rst-source" | "none";

export type BodySource =
  | { kind: "repository" }
  | {
      kind: "github-issue";
      url: string;
      title: string;
      updatedAt: string;
      fetchedAt: string;
      contentHash: string;
    }
  | { kind: "none" };

export type ZipRecord = {
  id: string;
  number: number | null;
  slug: string;
  title: string;
  status: StatusEntry[];
  statusRaw: string;
  category: string | null;
  owners: Owner[];
  created: string | null;
  license: string | null;
  discussionsTo: string | null;
  nuIds: string[];
  citations: number[];
  citedBy: number[];
  sourcePath: string;
  officialUrl: string;
  githubUrl: string;
  bodyKind: "md" | "rst" | "draft" | "none";
  bodyFormat?: BodyFormat;
  body: string | null;
  bodySource?: BodySource;
  parseWarnings: string[];
};

export type NuEntry = {
  id: string;
  title: string;
  kind: "settled" | "candidate";
  deploymentZip: number | null;
  zips: number[];
  notes?: string;
};

export type NuOverlay = { nus: NuEntry[] };

export type ZipIndexFile = {
  snapshot: { sha: string; date: string; url: string };
  zips: ZipRecord[];
  nus: NuEntry[];
  dangling: number[];
};
