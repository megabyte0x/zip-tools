import { spawnSync } from "node:child_process";
import { basename } from "node:path";
import type { ZipRecord } from "./types.ts";

export type RenderBodyResult = {
  bodyKind: ZipRecord["bodyKind"];
  body: string | null;
  warning?: string;
};

function rstToHtml(text: string): { body: string | null; warning?: string } {
  try {
    const result = spawnSync("pandoc", ["-f", "rst", "-t", "html"], {
      input: text,
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

    return { body: result.stdout };
  } catch (err) {
    const warning = err instanceof Error ? err.message : String(err);
    return { body: null, warning };
  }
}

export function renderBody(sourcePath: string, text: string): RenderBodyResult {
  const name = basename(sourcePath);
  const isDraft = name.startsWith("draft-");
  const isRst = name.endsWith(".rst");

  if (isRst) {
    const rendered = rstToHtml(text);
    return {
      bodyKind: isDraft ? "draft" : "rst",
      body: rendered.body,
      ...(rendered.warning !== undefined ? { warning: rendered.warning } : {}),
    };
  }

  if (isDraft) {
    return { bodyKind: "draft", body: text };
  }

  return { bodyKind: "md", body: text };
}
