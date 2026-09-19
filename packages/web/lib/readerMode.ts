import type { ZipRecord } from "./types";

export const FALLBACK_CTA = "Open on zips.z.cash";

export function readerMode(
  body: string | null,
  bodyKind: ZipRecord["bodyKind"],
): "fallback" | "html" | "markdown" | "source" {
  if (body === null) return "fallback";
  if (bodyKind === "rst") {
    return /^\s*</.test(body) ? "html" : "source";
  }
  return "markdown";
}
