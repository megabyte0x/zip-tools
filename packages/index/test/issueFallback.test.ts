import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, dirname, join, relative } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { test } from "node:test";
import ts from "typescript";
import { buildIndex } from "../src/build.ts";
import { issueBodyHash, readIssueSnapshots } from "../src/issueSnapshots.ts";
import { readSnapshotMeta } from "../src/snapshot.ts";
import type { IssueSnapshot, NuOverlay, ZipRecord } from "../src/types.ts";

const issueUrl = "https://github.com/zcash/zips/issues/1302";
const fixtureDir = fileURLToPath(new URL("./fixtures/issue-fallback", import.meta.url));
const fixturePath = join(fixtureDir, "zip-2007.md");
const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const committedSnapshotPath = join(packageRoot, "issue-snapshots.json");
const pinnedSourceDir = join(packageRoot, "../../submodule/zips");

// This module gate validates every saved entry and content hash before any test can generate an index.
const committedSnapshotGate = readIssueSnapshots(committedSnapshotPath);
assert.ok(committedSnapshotGate.issues[issueUrl], "missing committed issue #1302 snapshot");

function fixtureOpts(sourceDir = fixtureDir) {
  return {
    sourceDir,
    overlay: { nus: [] },
    sha: "fixture",
    date: "2026-09-23T00:00:00Z",
  };
}

function syntheticIssue(
  body = "## Motivation\n\nSynthetic fixture referring to ZIP 2005.",
): IssueSnapshot {
  return {
    url: issueUrl,
    number: 1302,
    title: "Fixture discussion",
    body,
    updatedAt: "2026-07-05T21:00:43Z",
    fetchedAt: "2026-09-23T00:00:00Z",
    contentHash: issueBodyHash(body),
  };
}

function snapshots(issue = syntheticIssue()) {
  return { version: 1 as const, issues: { [issue.url]: issue } };
}

function record(index: ReturnType<typeof buildIndex>, id: string) {
  const zip = index.zips.find((candidate) => candidate.id === id);
  assert.ok(zip, `missing ZIP record ${id}`);
  if (!zip) throw new Error(`missing ZIP record ${id}`);
  return zip;
}

function withCopiedFixture<T>(run: (sourceDir: string) => T): T {
  const sourceDir = mkdtempSync(join(tmpdir(), "zip-index-issue-fallback-"));
  copyFileSync(fixturePath, join(sourceDir, "zip-2007.md"));
  try {
    return run(sourceDir);
  } finally {
    rmSync(sourceDir, { recursive: true, force: true });
  }
}

function runCli(
  sourceDir: string,
  outDir: string,
  snapshotsPath: string,
  overlayPath?: string,
) {
  const args = [
    "src/cli.ts",
    "build",
    "--source",
    sourceDir,
    "--out",
    outDir,
    "--snapshots",
    snapshotsPath,
  ];
  if (overlayPath) args.push("--overlay", overlayPath);
  return spawnSync("tsx", args, { cwd: packageRoot, encoding: "utf8" });
}

function writeEmptyOverlay(dir: string): string {
  const overlayPath = join(dir, "overlay.json");
  writeFileSync(overlayPath, `${JSON.stringify({ nus: [] })}\n`, "utf8");
  return overlayPath;
}

type ImportedBinding = {
  moduleSpecifier: string;
  targetPath?: string;
  importedName: string;
};

type ModuleInfo = {
  path: string;
  imports: Map<string, ImportedBinding>;
  functions: Map<string, ts.FunctionDeclaration>;
};

type SubprocessCall = {
  file: string;
  command: string;
  args: string[];
};

const networkModuleSpecifiers = new Set([
  "http",
  "https",
  "http2",
  "net",
  "tls",
  "node:http",
  "node:https",
  "node:http2",
  "node:net",
  "node:tls",
  "undici",
  "axios",
  "got",
]);

function sourcePath(path: string) {
  return relative(packageRoot, path).replaceAll("\\", "/");
}

function expressionSignature(expression: ts.Expression): string {
  if (ts.isStringLiteral(expression)) return expression.text;
  if (ts.isIdentifier(expression)) return `$${expression.text}`;
  if (ts.isArrayLiteralExpression(expression)) {
    return `[${expression.elements.map((element) => {
      if (!ts.isExpression(element)) return "<spread>";
      return expressionSignature(element);
    }).join(",")}]`;
  }
  return `<${ts.SyntaxKind[expression.kind]}>`;
}

function localImportTarget(fromPath: string, moduleSpecifier: string): string | undefined {
  if (!moduleSpecifier.startsWith(".")) return undefined;
  const path = join(dirname(fromPath), moduleSpecifier);
  return existsSync(path) ? path : undefined;
}

function inspectModule(path: string, cache: Map<string, ModuleInfo>): ModuleInfo {
  const existing = cache.get(path);
  if (existing) return existing;

  const source = ts.createSourceFile(
    path,
    readFileSync(path, "utf8"),
    ts.ScriptTarget.Latest,
    true,
  );
  const imports = new Map<string, ImportedBinding>();
  const functions = new Map<string, ts.FunctionDeclaration>();
  for (const statement of source.statements) {
    if (ts.isFunctionDeclaration(statement) && statement.name) {
      functions.set(statement.name.text, statement);
      continue;
    }
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) continue;
    const clause = statement.importClause;
    if (!clause || clause.isTypeOnly) continue;
    const moduleSpecifier = statement.moduleSpecifier.text;
    const targetPath = localImportTarget(path, moduleSpecifier);
    if (clause.name) {
      imports.set(clause.name.text, { moduleSpecifier, targetPath, importedName: "default" });
    }
    if (clause.namedBindings && ts.isNamedImports(clause.namedBindings)) {
      for (const element of clause.namedBindings.elements) {
        if (element.isTypeOnly) continue;
        imports.set(element.name.text, {
          moduleSpecifier,
          targetPath,
          importedName: element.propertyName?.text ?? element.name.text,
        });
      }
    }
  }
  const info = { path, imports, functions };
  cache.set(path, info);
  return info;
}

function buildBranch(main: ts.FunctionDeclaration): ts.Statement {
  let branch: ts.Statement | undefined;
  const visit = (node: ts.Node) => {
    if (branch) return;
    if (ts.isIfStatement(node)) {
      const condition = node.expression;
      if (
        ts.isBinaryExpression(condition) &&
        condition.operatorToken.kind === ts.SyntaxKind.EqualsEqualsEqualsToken &&
        ts.isElementAccessExpression(condition.left) &&
        ts.isIdentifier(condition.left.expression) &&
        condition.left.expression.text === "argv" &&
        condition.left.argumentExpression !== undefined &&
        ts.isNumericLiteral(condition.left.argumentExpression) &&
        condition.left.argumentExpression.text === "0" &&
        ts.isStringLiteral(condition.right) &&
        condition.right.text === "build"
      ) {
        branch = node.thenStatement;
        return;
      }
    }
    ts.forEachChild(node, visit);
  };
  ts.forEachChild(main, visit);
  if (!branch) throw new Error("CLI must retain an explicit build command branch");
  return branch;
}

function traceNormalBuildCallGraph() {
  const cache = new Map<string, ModuleInfo>();
  const entry = inspectModule(join(packageRoot, "src/cli.ts"), cache);
  const main = entry.functions.get("main");
  if (!main) throw new Error("CLI main function is missing");

  const queue: Array<{ module: ModuleInfo; node: ts.Node; label: string }> = [
    { module: entry, node: buildBranch(main), label: "build branch" },
  ];
  const visited = new Set<string>();
  const reachedFunctions = new Set<string>();
  const calledNetworkModules = new Set<string>();
  const externalRuntimeModules = new Set<string>();
  const forbiddenGlobalCalls = new Set<string>();
  const unexpectedSubprocessCalls = new Set<string>();
  const subprocesses: SubprocessCall[] = [];

  const enqueueDefaultParameter = (module: ModuleInfo, node: ts.Node, name: string): boolean => {
    if (!ts.isFunctionDeclaration(node)) return false;
    const parameter = node.parameters.find((candidate) => ts.isIdentifier(candidate.name) && candidate.name.text === name);
    if (!parameter || !parameter.initializer || !ts.isIdentifier(parameter.initializer)) return false;
    const defaultFunction = module.functions.get(parameter.initializer.text);
    if (!defaultFunction) return false;
    queue.push({
      module,
      node: defaultFunction,
      label: `${sourcePath(module.path)}:${parameter.initializer.text}`,
    });
    return true;
  };

  const inspectCall = (module: ModuleInfo, owner: ts.Node, call: ts.CallExpression) => {
    if (call.expression.kind === ts.SyntaxKind.ImportKeyword) {
      forbiddenGlobalCalls.add("dynamic import");
      return;
    }
    let name: string | undefined;
    let binding: ImportedBinding | undefined;
    if (ts.isIdentifier(call.expression)) {
      name = call.expression.text;
      binding = module.imports.get(name);
    } else if (
      ts.isPropertyAccessExpression(call.expression) &&
      ts.isIdentifier(call.expression.expression)
    ) {
      name = call.expression.name.text;
      binding = module.imports.get(call.expression.expression.text);
    } else {
      return;
    }

    if (binding) {
      if (networkModuleSpecifiers.has(binding.moduleSpecifier)) {
        calledNetworkModules.add(binding.moduleSpecifier);
      }
      if (binding.moduleSpecifier === "node:child_process" || binding.moduleSpecifier === "child_process") {
        if (name !== "spawnSync") {
          unexpectedSubprocessCalls.add(`${sourcePath(module.path)}:${name}`);
          return;
        }
        const [command, args] = call.arguments;
        subprocesses.push({
          file: sourcePath(module.path),
          command: command ? expressionSignature(command) : "<missing>",
          args: args && ts.isArrayLiteralExpression(args)
            ? args.elements.map((argument) =>
              ts.isExpression(argument) ? expressionSignature(argument) : "<spread>")
            : [args ? expressionSignature(args) : "<missing>"],
        });
        return;
      }
      if (binding.targetPath) {
        const target = inspectModule(binding.targetPath, cache);
        const targetFunction = target.functions.get(binding.importedName);
        if (!targetFunction) {
          throw new Error(
            `runtime import ${binding.importedName} from ${sourcePath(target.path)} must be a named function`,
          );
        }
        queue.push({
          module: target,
          node: targetFunction,
          label: `${sourcePath(target.path)}:${binding.importedName}`,
        });
        return;
      }
      if (!binding.moduleSpecifier.startsWith("node:")) {
        externalRuntimeModules.add(binding.moduleSpecifier);
      }
      return;
    }

    if (name && module.functions.has(name)) {
      queue.push({ module, node: module.functions.get(name)!, label: `${sourcePath(module.path)}:${name}` });
      return;
    }
    if (name && enqueueDefaultParameter(module, owner, name)) return;
    if (name && ["fetch", "require", "eval", "WebSocket"].includes(name)) {
      forbiddenGlobalCalls.add(name);
    }
  };

  while (queue.length > 0) {
    const current = queue.shift()!;
    const key = `${current.module.path}:${current.label}`;
    if (visited.has(key)) continue;
    visited.add(key);
    reachedFunctions.add(current.label);

    const visit = (node: ts.Node) => {
      if (node !== current.node && ts.isFunctionDeclaration(node)) return;
      if (ts.isCallExpression(node)) inspectCall(current.module, current.node, node);
      ts.forEachChild(node, visit);
    };
    visit(current.node);
  }

  return {
    reachedFunctions: [...reachedFunctions].sort(),
    calledNetworkModules: [...calledNetworkModules].sort(),
    externalRuntimeModules: [...externalRuntimeModules].sort(),
    forbiddenGlobalCalls: [...forbiddenGlobalCalls].sort(),
    unexpectedSubprocessCalls: [...unexpectedSubprocessCalls].sort(),
    subprocesses: subprocesses.sort((left, right) =>
      `${left.file}:${left.command}:${left.args.join(",")}`.localeCompare(
        `${right.file}:${right.command}:${right.args.join(",")}`,
      )),
  };
}

// Catches the production index preserving a metadata-only repository header instead of selecting a saved linked issue body.
test("metadata-only ZIP uses the saved linked description", () => {
  const url = "https://github.com/zcash/zips/issues/1302";
  const body = "## Motivation\n\nSynthetic fixture referring to ZIP 2005.";
  const issue = {
    url,
    number: 1302,
    title: "Fixture discussion",
    body,
    updatedAt: "2026-07-05T21:00:43Z",
    fetchedAt: "2026-09-23T00:00:00Z",
    contentHash: issueBodyHash(body),
  };
  const opts = {
    sourceDir: fileURLToPath(new URL("./fixtures/issue-fallback", import.meta.url)),
    overlay: { nus: [] },
    sha: "fixture",
    date: "2026-09-23T00:00:00Z",
  };
  const missingIndex = buildIndex(opts);
  const missing = missingIndex.zips[0];
  assert.equal(missing.body, null);
  assert.deepEqual(missing.bodySource, { kind: "none" });
  const index = buildIndex({
    ...opts,
    issueSnapshots: { version: 1, issues: { [url]: issue } },
  });
  const zip = index.zips[0];
  assert.equal(zip.body, body);
  assert.equal(zip.bodyFormat, "markdown");
  assert.equal(zip.bodySource?.kind, "github-issue");
  assert.equal(zip.statusRaw, "Reserved");
  assert.deepEqual(zip.citations, missing.citations);
  assert.equal(zip.githubUrl, missing.githubUrl);
  assert.deepEqual(zip.owners, missing.owners);
  assert.equal(zip.category, missing.category);
  assert.equal(zip.license, missing.license);
  assert.deepEqual(zip.owners, [
    { name: "Daira-Emma Hopwood", email: "daira@jacaranda.org" },
  ]);
  assert.equal(zip.category, "Consensus");
  assert.equal(zip.license, "MIT");
  assert.deepEqual(zip.citedBy, missing.citedBy);
  assert.deepEqual(index.dangling, missingIndex.dangling);
});

// Catches an issue cache overwriting an actual repository body merely because its header links to an issue.
test("substantive repository body takes precedence over the saved issue", () => {
  withCopiedFixture((sourceDir) => {
    const source = `${readFileSync(join(sourceDir, "zip-2007.md"), "utf8")}\nRepository body takes precedence.\n`;
    writeFileSync(join(sourceDir, "zip-2007.md"), source, "utf8");

    const zip = record(
      buildIndex({ ...fixtureOpts(sourceDir), issueSnapshots: snapshots() }),
      "2007",
    );
    assert.equal(zip.body, source);
    assert.equal(zip.bodySource?.kind, "repository");
    assert.equal(zip.bodyFormat, "markdown");
  });
});

// Catches an outdated or inherited cache entry being used after the source link changes or is absent.
test("metadata-only copies require an own matching issue snapshot", () => {
  withCopiedFixture((sourceDir) => {
    const withoutCache = record(buildIndex(fixtureOpts(sourceDir)), "2007");
    assert.equal(withoutCache.body, null);
    assert.deepEqual(withoutCache.bodySource, { kind: "none" });

    const inheritedIssues = Object.create({ [issueUrl]: syntheticIssue() }) as Record<
      string,
      IssueSnapshot
    >;
    const inherited = record(
      buildIndex({
        ...fixtureOpts(sourceDir),
        issueSnapshots: { version: 1, issues: inheritedIssues },
      }),
      "2007",
    );
    assert.equal(inherited.body, null);
    assert.deepEqual(inherited.bodySource, { kind: "none" });

    const changedUrl = "https://github.com/zcash/zips/issues/1303";
    const changed = readFileSync(join(sourceDir, "zip-2007.md"), "utf8").replace(
      issueUrl,
      changedUrl,
    );
    writeFileSync(join(sourceDir, "zip-2007.md"), changed, "utf8");
    const stale = record(
      buildIndex({ ...fixtureOpts(sourceDir), issueSnapshots: snapshots() }),
      "2007",
    );
    assert.equal(stale.discussionsTo, changedUrl);
    assert.equal(stale.body, null);
    assert.deepEqual(stale.bodySource, { kind: "none" });
  });
});

// Catches fallback selection losing draft identity or treating an issue reference as unsupported for a draft.
test("metadata-only drafts select an explicitly linked saved issue", () => {
  withCopiedFixture((sourceDir) => {
    writeFileSync(
      join(sourceDir, "draft-issue-fallback.md"),
      `    ZIP: Draft\n    Title: Draft issue fallback\n    Owners: Test Owner <test@example.com>\n    Status: Draft\n    Category: Process\n    Created: 2026-09-23\n    License: MIT\n    Discussions-To: <${issueUrl}>\n`,
      "utf8",
    );

    const index = buildIndex({
      ...fixtureOpts(sourceDir),
      issueSnapshots: snapshots(),
    });
    const draft = record(index, "draft-issue-fallback");
    assert.equal(draft.number, null);
    assert.equal(draft.slug, "draft-issue-fallback");
    assert.equal(draft.sourcePath, "draft-issue-fallback.md");
    assert.equal(draft.body, syntheticIssue().body);
    assert.equal(draft.bodyKind, "md");
    assert.equal(draft.bodyFormat, "markdown");
    assert.equal(draft.bodySource?.kind, "github-issue");
    assert.deepEqual(draft.citations, []);
    assert.deepEqual(index.dangling, []);
  });
});

// Catches converter warnings being mistaken for an empty RST source and triggering an issue fallback.
test("RST source with a converter failure remains source-backed", () => {
  withCopiedFixture((sourceDir) => {
    const rst = `::\n\n  ZIP: 2008\n  Title: RST source fallback guard\n  Owners: Test Owner <test@example.com>\n  Status: Draft\n  Category: Process\n  Created: 2026-09-23\n  License: MIT\n  Discussions-To: <${issueUrl}>\n\nSource-backed RST body.\n`;
    writeFileSync(join(sourceDir, "zip-2008.rst"), rst, "utf8");
    const fakeBin = join(sourceDir, "fake-bin");
    mkdirSync(fakeBin);
    const fakePandoc = join(fakeBin, "pandoc");
    writeFileSync(
      fakePandoc,
      "#!/bin/sh\nwhile IFS= read -r line || [ -n \"$line\" ]; do :; done\nexit 12\n",
      "utf8",
    );
    chmodSync(fakePandoc, 0o755);

    const originalPath = process.env.PATH;
    try {
      process.env.PATH = `${fakeBin}${delimiter}${originalPath ?? ""}`;
      const zip = record(
        buildIndex({ ...fixtureOpts(sourceDir), issueSnapshots: snapshots() }),
        "2008",
      );
      assert.equal(zip.body, rst);
      assert.equal(zip.bodyKind, "rst");
      assert.equal(zip.bodyFormat, "rst-source");
      assert.deepEqual(zip.bodySource, { kind: "repository" });
      assert.match(zip.parseWarnings.join("\n"), /pandoc exited 12/);
    } finally {
      if (originalPath === undefined) delete process.env.PATH;
      else process.env.PATH = originalPath;
    }
  });
});

// Catches a failed RST conversion warning sticking to a body that was replaced by a saved issue.
test("issue-backed body does not keep an unused pandoc warning", () => {
  const sourceDir = mkdtempSync(join(tmpdir(), "zip-index-issue-warning-"));
  const fakeBin = join(sourceDir, "fake-bin");
  mkdirSync(fakeBin);
  const fakePandoc = join(fakeBin, "pandoc");
  writeFileSync(fakePandoc, "#!/bin/sh\ncat >/dev/null\nexit 12\n", "utf8");
  chmodSync(fakePandoc, 0o755);
  writeFileSync(
    join(sourceDir, "zip-0240.rst"),
    `::\n\n  ZIP: 240\n  Title: Header only\n  Status: Reserved\n  Category: Consensus\n  Discussions-To: <${issueUrl}>\n`,
    "utf8",
  );
  const originalPath = process.env.PATH;
  try {
    process.env.PATH = `${fakeBin}${delimiter}${originalPath ?? ""}`;
    const zip = record(
      buildIndex({ ...fixtureOpts(sourceDir), issueSnapshots: snapshots() }),
      "240",
    );
    assert.equal(zip.body, syntheticIssue().body);
    assert.equal(zip.bodySource?.kind, "github-issue");
    assert.equal(zip.parseWarnings.some((warning) => /pandoc/i.test(warning)), false);
  } finally {
    if (originalPath === undefined) delete process.env.PATH;
    else process.env.PATH = originalPath;
    rmSync(sourceDir, { recursive: true, force: true });
  }
});

// Catches the build boundary skipping validation or validating only after attempting to scan source files.
test("buildIndex validates supplied snapshots at entry", () => {
  assert.throws(
    () =>
      buildIndex({
        ...fixtureOpts(join(tmpdir(), "does-not-need-to-exist")),
        issueSnapshots: { version: 2, issues: {} } as never,
      }),
    /Unsupported issue snapshot version/,
  );
});

// Catches the CLI silently ignoring a valid --snapshots file instead of supplying it to the offline builder.
test("CLI build selects a saved snapshot body", () => {
  const tempDir = mkdtempSync(join(tmpdir(), "zip-index-cli-snapshot-"));
  try {
    const snapshotPath = join(tempDir, "issues.json");
    const outDir = join(tempDir, "out");
    writeFileSync(snapshotPath, `${JSON.stringify(snapshots(), null, 2)}\n`, "utf8");

    const result = runCli(fixtureDir, outDir, snapshotPath, writeEmptyOverlay(tempDir));
    assert.equal(result.status, 0, `${result.stderr}${result.stdout}`);
    const output = JSON.parse(readFileSync(join(outDir, "zip-index.json"), "utf8"));
    assert.equal(output.zips[0].body, syntheticIssue().body);
    assert.equal(output.zips[0].bodySource.kind, "github-issue");
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

// Catches first-run CLI builds treating a missing optional snapshot file as a fatal cache error.
test("CLI build succeeds when the optional snapshot file is missing", () => {
  const tempDir = mkdtempSync(join(tmpdir(), "zip-index-cli-missing-snapshot-"));
  try {
    const outDir = join(tempDir, "out");
    const result = runCli(
      fixtureDir,
      outDir,
      join(tempDir, "missing.json"),
      writeEmptyOverlay(tempDir),
    );
    assert.equal(result.status, 0, `${result.stderr}${result.stdout}`);
    assert.equal(existsSync(join(outDir, "zip-index.json")), true);
    const output = JSON.parse(readFileSync(join(outDir, "zip-index.json"), "utf8"));
    assert.equal(output.zips[0].body, null);
    assert.deepEqual(output.zips[0].bodySource, { kind: "none" });
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

// Catches the CLI accepting malformed snapshot input rather than failing before writing a misleading index.
test("CLI build fails for malformed snapshots", () => {
  const tempDir = mkdtempSync(join(tmpdir(), "zip-index-cli-malformed-snapshot-"));
  try {
    const snapshotPath = join(tempDir, "issues.json");
    const outDir = join(tempDir, "out");
    writeFileSync(snapshotPath, "{ malformed JSON\n", "utf8");

    const result = runCli(fixtureDir, outDir, snapshotPath);
    assert.equal(result.status, 1, `${result.stderr}${result.stdout}`);
    assert.equal(existsSync(join(outDir, "zip-index.json")), false);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

function sourceMetadata(record: ZipRecord) {
  const {
    body: _body,
    bodyKind: _bodyKind,
    bodyFormat: _bodyFormat,
    bodySource: _bodySource,
    ...metadata
  } = record;
  return metadata;
}

// Catches a stale generated record or an index path that fails to use the checked-in #1302 capture.
test("pinned ZIP 2007 source metadata is preserved when its saved issue body is selected", () => {
  // Validate the committed capture before either source build; malformed input must fail rather than be repaired.
  const committedSnapshots = readIssueSnapshots(committedSnapshotPath);
  const issue = committedSnapshots.issues[issueUrl];
  assert.ok(issue, "missing committed issue #1302 snapshot");
  assert.equal(issue.contentHash, issueBodyHash(issue.body));

  const overlay = JSON.parse(readFileSync(join(packageRoot, "nu.json"), "utf8")) as NuOverlay;
  const snapshot = readSnapshotMeta(pinnedSourceDir);
  const sourceOnly = record(
    buildIndex({
      sourceDir: pinnedSourceDir,
      overlay,
      sha: snapshot.sha,
      date: snapshot.date,
    }),
    "2007",
  );
  const indexed = record(
    buildIndex({
      sourceDir: pinnedSourceDir,
      overlay,
      sha: snapshot.sha,
      date: snapshot.date,
      issueSnapshots: committedSnapshots,
    }),
    "2007",
  );

  assert.equal(indexed.body, issue.body);
  assert.equal(indexed.bodySource?.kind, "github-issue");
  assert.deepEqual(indexed.bodySource, {
    kind: "github-issue",
    url: issue.url,
    title: issue.title,
    updatedAt: issue.updatedAt,
    fetchedAt: issue.fetchedAt,
    contentHash: issue.contentHash,
  });
  assert.deepEqual(sourceMetadata(indexed), sourceMetadata(sourceOnly));
});

// Catches a build command that reaches the refresh path, or any other fetch use, instead of using a validated capture.
test("normal CLI build selects saved issue content without network access", () => {
  const work = mkdtempSync(join(tmpdir(), "zip-offline-"));
  const cachePath = committedSnapshotPath;
  // Validation deliberately happens before the child can generate an index.
  const committedSnapshots = readIssueSnapshots(cachePath);
  const savedIssue = committedSnapshots.issues[issueUrl];
  assert.ok(savedIssue, "missing committed issue #1302 snapshot");
  try {
    const shim = join(work, "no-fetch.mjs");
    writeFileSync(
      shim,
      'globalThis.fetch = async () => { throw new Error("unexpected network request"); };\n',
    );
    const out = join(work, "out");
    const env = { ...process.env };
    delete env.GITHUB_TOKEN;
    delete env.GH_TOKEN;
    const result = spawnSync(
      process.execPath,
      [
        "--import",
        pathToFileURL(shim).href,
        "--import",
        "tsx",
        "src/cli.ts",
        "build",
        "--source",
        "../../submodule/zips",
        "--out",
        out,
        "--snapshots",
        cachePath,
      ],
      { cwd: packageRoot, env, encoding: "utf8" },
    );
    assert.equal(result.status, 0, `${result.stderr}${result.stdout}`);
    const index = JSON.parse(readFileSync(join(out, "zip-index.json"), "utf8"));
    const zip = index.zips.find((candidate: { id: string }) => candidate.id === "2007");
    assert.ok(zip, "missing ZIP 2007 from CLI output");
    assert.equal(zip.body, savedIssue.body);
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
});

// Catches a future build-branch shortcut to refresh, an alternate HTTP client, or an unapproved child process.
test("normal CLI build call graph permits only local metadata and RST-converter subprocesses", () => {
  const graph = traceNormalBuildCallGraph();

  assert.equal(
    graph.reachedFunctions.some((name) => name.includes("refreshIssueSnapshots") || name.includes("refreshIssues.ts")),
    false,
  );
  assert.deepEqual(graph.calledNetworkModules, []);
  assert.deepEqual(graph.externalRuntimeModules, []);
  assert.deepEqual(graph.forbiddenGlobalCalls, []);
  assert.deepEqual(graph.unexpectedSubprocessCalls, []);
  assert.deepEqual(graph.subprocesses, [
    {
      file: "src/renderBody.ts",
      command: "pandoc",
      args: ["-f", "rst", "-t", "html", "--mathjax", "--wrap=none"],
    },
    {
      file: "src/snapshot.ts",
      command: "git",
      args: ["-C", "$sourceDir", "log", "-1", "--format=%cI"],
    },
    {
      file: "src/snapshot.ts",
      command: "git",
      args: ["-C", "$sourceDir", "rev-parse", "HEAD"],
    },
  ]);
});
