import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { basename, extname, join, relative } from "node:path";
import { extractCitations } from "./citations.ts";
import { applyOverlay } from "./overlay.ts";
import { parseHeader } from "./parseHeader.ts";
import { parseStatus } from "./parseStatus.ts";
import { renderBody } from "./renderBody.ts";
import type { NuOverlay, ZipIndexFile, ZipRecord } from "./types.ts";
import { githubBlobUrl, officialUrl, padZip } from "./urls.ts";

export type BuildIndexOpts = {
  sourceDir: string;
  overlay: NuOverlay;
  sha: string;
  date: string;
};

function snapshotUrl(sha: string): string {
  if (!sha || sha === "fixture") return "";
  return `https://github.com/zcash/zips/commit/${sha}`;
}

function scanRoot(sourceDir: string): string {
  const nested = join(sourceDir, "zips");
  if (existsSync(nested) && statSync(nested).isDirectory()) return nested;
  return sourceDir;
}

function isSourceFile(name: string): boolean {
  if (name.startsWith("zip-guide") || name.startsWith("zip-template")) return false;
  if (!(name.startsWith("zip-") || name.startsWith("draft-"))) return false;
  return name.endsWith(".md") || name.endsWith(".rst");
}

function listSourceFiles(sourceDir: string): string[] {
  if (!existsSync(sourceDir)) {
    throw new Error(`sourceDir missing: ${sourceDir}`);
  }
  const st = statSync(sourceDir);
  if (!st.isDirectory()) {
    throw new Error(`sourceDir is not a directory: ${sourceDir}`);
  }

  const root = scanRoot(sourceDir);
  const names = readdirSync(root, { withFileTypes: true });
  const files: string[] = [];
  for (const ent of names) {
    if (!ent.isFile()) continue;
    if (!isSourceFile(ent.name)) continue;
    files.push(join(root, ent.name));
  }
  if (files.length === 0) {
    throw new Error(`no zip-* / draft-* source files in ${sourceDir}`);
  }
  return files.sort();
}

function slugFor(number: number | null, filename: string): string {
  if (number !== null) return `zip-${padZip(number)}`;
  return basename(filename, extname(filename));
}

function recordFromFile(path: string, sourceDir: string, sha: string): ZipRecord {
  const text = readFileSync(path, "utf8");
  const header = parseHeader(text);
  const sourcePath = relative(sourceDir, path).replaceAll("\\", "/");
  const slug = slugFor(header.number, path);
  const id = header.number !== null ? String(header.number) : slug;
  const rendered = renderBody(sourcePath, text);
  const parseWarnings = [...header.warnings];
  if (rendered.warning) parseWarnings.push(rendered.warning);

  return {
    id,
    number: header.number,
    slug,
    title: header.title,
    status: parseStatus(header.statusRaw),
    statusRaw: header.statusRaw,
    category: header.category,
    owners: header.owners,
    created: header.created,
    license: header.license,
    discussionsTo: header.discussionsTo,
    nuIds: [],
    citations: extractCitations(text, header.number),
    citedBy: [],
    sourcePath,
    officialUrl: officialUrl(header.number, slug),
    githubUrl: githubBlobUrl(sha, sourcePath),
    bodyKind: rendered.bodyKind,
    body: rendered.body,
    parseWarnings,
  };
}

function invertCitations(zips: ZipRecord[]): number[] {
  const byNumber = new Map<number, ZipRecord>();
  for (const z of zips) {
    if (z.number !== null) byNumber.set(z.number, z);
  }

  const dangling = new Set<number>();
  for (const z of zips) {
    for (const cited of z.citations) {
      const target = byNumber.get(cited);
      if (!target) {
        dangling.add(cited);
        continue;
      }
      if (z.number !== null) target.citedBy.push(z.number);
    }
  }

  for (const z of zips) {
    z.citedBy = [...new Set(z.citedBy)].sort((a, b) => a - b);
  }
  return [...dangling].sort((a, b) => a - b);
}

export function buildIndex(opts: BuildIndexOpts): ZipIndexFile {
  const files = listSourceFiles(opts.sourceDir);
  const raw = files.map((f) => recordFromFile(f, opts.sourceDir, opts.sha));
  const { zips } = applyOverlay(raw, opts.overlay);
  const dangling = invertCitations(zips);

  zips.sort((a, b) => {
    if (a.number !== null && b.number !== null) return a.number - b.number;
    if (a.number !== null) return -1;
    if (b.number !== null) return 1;
    return a.slug.localeCompare(b.slug);
  });

  return {
    snapshot: {
      sha: opts.sha,
      date: opts.date,
      url: snapshotUrl(opts.sha),
    },
    zips,
    nus: opts.overlay.nus,
    dangling,
  };
}

export function writeIndex(outDir: string, index: ZipIndexFile): void {
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "zip-index.json"), `${JSON.stringify(index, null, 2)}\n`);
}
