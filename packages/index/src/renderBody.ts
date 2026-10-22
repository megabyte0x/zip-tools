import { spawnSync } from "node:child_process";
import { basename } from "node:path";
import { prepareRstFootnotes } from "./rstFootnotes.ts";
import { protectRstMath } from "./rstMath.ts";
import type { ZipRecord } from "./types.ts";

export type RenderBodyResult = {
  bodyKind: ZipRecord["bodyKind"];
  bodyFormat: NonNullable<ZipRecord["bodyFormat"]>;
  body: string | null;
  warning?: string;
};

export type RstConverter = (source: string) => { body: string | null; warning?: string };

/**
 * Pandoc does not support `.. |name| raw:: html` substitution definitions: it drops every
 * `|name|` and prints the definition body as a block quote (ZIP 317's `|br|`). Rewrite them
 * as the equivalent raw role, which pandoc honors (its role names allow only letters and `-`).
 */
function expandRawSubstitutions(source: string): string {
  const references = new Map<string, string>();
  const defined = source.replace(
    /^\.\. \|([^|\n]+)\| raw:: ([a-z]+)[ \t]*\n((?:[ \t]*\n|[ \t]+\S.*(?:\n|$))*)/gm,
    (_, name: string, format: string, body: string) => {
      references.set(`|${name}|`, `:raw-${format}:\`${body.trim().split(/\s*\n\s*/).join(" ")}\``);
      return `.. role:: raw-${format}(raw)\n   :format: ${format}\n\n`;
    },
  );
  let expanded = defined;
  for (const [reference, role] of references) expanded = expanded.replaceAll(reference, role);
  return expanded;
}

/** Where pandoc's reader is laxer than docutils, rewrite the source to read as docutils does. */
function matchDocutils(source: string): string {
  return source
    // `.. name::arg` without a space is a comment to docutils, hiding its indented body (ZIP 68).
    .replace(/^\.\. [\w-]+::\S.*\n(?:[ \t]*\n|[ \t]+\S.*(?:\n|$))*/gm, "")
    // Docutils starts no inline markup right after `_`, so `_might_` is literal text (ZIP 315).
    .replace(/(^|[\s(])_([A-Za-z][\w-]*)_(?=[\s.,;:)]|$)/gm, "$1_$2\\_");
}

function rstToHtml(text: string): ReturnType<RstConverter> {
  try {
    // RST cannot nest code backticks in a citation link title; retain the label as plain text.
    const footnotes = prepareRstFootnotes(expandRawSubstitutions(matchDocutils(text)).replace(
      /^(\.\. \[[^\]\n]+\][ \t]+)`(.*?) <([^>\n]+)>`_/gm,
      (_, prefix: string, label: string, target: string) => `${prefix}\`${label.replaceAll("`", "")} <${target}>\`_`,
    ));
    // --mathjax keeps TeX in \( \) and \[ \] spans; the reader renders them with KaTeX.
    const result = spawnSync("pandoc", ["-f", "rst", "-t", "html", "--mathjax", "--wrap=none"], {
      input: protectRstMath(footnotes.source),
      encoding: "utf8",
      timeout: 15_000,
      maxBuffer: 16 * 1024 * 1024,
    });

    if (result.error) {
      const err = result.error as NodeJS.ErrnoException;
      const warning = err.code === "ENOENT" ? "pandoc not found" : err.message;
      return { body: null, warning };
    }

    if (result.status !== 0) {
      const stderr = result.stderr?.trim();
      const warning =
        stderr ||
        (result.signal ? `pandoc killed by ${result.signal}` : `pandoc exited ${result.status}`);
      return { body: null, warning };
    }

    return { body: footnotes.place(result.stdout) };
  } catch (err) {
    const warning = err instanceof Error ? err.message : String(err);
    return { body: null, warning };
  }
}

export function renderBody(
  sourcePath: string,
  text: string,
  convertRst: RstConverter = rstToHtml,
): RenderBodyResult {
  const name = basename(sourcePath);
  const isDraft = name.startsWith("draft-");
  const isRst = name.endsWith(".rst");

  if (isRst) {
    let rendered: ReturnType<RstConverter>;
    try {
      rendered = convertRst(text);
    } catch (err) {
      rendered = {
        body: null,
        warning: err instanceof Error ? err.message : String(err),
      };
    }
    const converted = rendered.body?.trim() ? rendered.body : null;
    const warning = converted === null ? rendered.warning ?? "RST converter returned empty output" : rendered.warning;
    return {
      bodyKind: isDraft ? "draft" : "rst",
      bodyFormat: converted === null ? "rst-source" : "html",
      body: converted ?? text,
      ...(warning !== undefined ? { warning } : {}),
    };
  }

  if (isDraft) {
    return { bodyKind: "draft", bodyFormat: "markdown", body: text };
  }

  return { bodyKind: "md", bodyFormat: "markdown", body: text };
}
