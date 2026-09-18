export type StatusEntry = {
  label: string;
  revision?: string;
  nuHint?: string;
};

export type Owner = { name: string; email?: string };

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
  body: string | null;
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
