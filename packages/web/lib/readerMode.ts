import type { BodyFormat, ZipRecord } from "./types";

export const FALLBACK_CTA = "Open on zips.z.cash";

function looksLikeRstSource(body: string): boolean {
  return /(?:^|\n)[^\n]+\n[=~\-`#"'^]{2,}(?:\n|$)/.test(body);
}

export function readerMode(
  body: string | null,
  bodyKind: ZipRecord["bodyKind"],
  bodyFormat?: BodyFormat,
): "fallback" | "html" | "markdown" | "source" {
  if (body === null || bodyFormat === "none") return "fallback";
  if (bodyFormat === "html") return "html";
  if (bodyFormat === "markdown") return "markdown";
  if (bodyFormat === "rst-source") return "source";

  if (bodyKind === "rst") {
    return /^\s*</.test(body) ? "html" : "source";
  }
  if (bodyKind === "draft" && looksLikeRstSource(body)) return "source";
  return "markdown";
}
