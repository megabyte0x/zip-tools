import { supportedIssueUrl } from "./readerSource";
import type { ZipRecord } from "./types";

const UNSAFE_SCHEME = /^(?:javascript|data|vbscript|file):/i;
const SAFE_ABSOLUTE_SCHEME = /^(?:https?|mailto):/i;

function safeAbsoluteUrl(value: string): string | null {
  if (!SAFE_ABSOLUTE_SCHEME.test(value)) return null;
  try {
    return new URL(value).href;
  } catch {
    return null;
  }
}

export function readerProposalHref(href: string): string {
  const value = href.trim();
  if (value === "" || UNSAFE_SCHEME.test(value)) return "#";
  if (value.startsWith("#")) return value;
  if (value.startsWith("//")) {
    try {
      const parsed = new URL(value, "https://zips.z.cash");
      return parsed.protocol === "https:" && parsed.hostname !== "" ? value : "#";
    } catch {
      return "#";
    }
  }

  let path = value;
  let fragment = "";
  if (SAFE_ABSOLUTE_SCHEME.test(value)) {
    const absolute = safeAbsoluteUrl(value);
    if (absolute === null) return "#";
    const parsed = new URL(absolute);
    if (parsed.protocol === "mailto:") return absolute;
    if (parsed.hostname !== "zips.z.cash") return absolute;
    path = parsed.pathname;
    fragment = parsed.hash;
  } else {
    const hashAt = value.indexOf("#");
    if (hashAt >= 0) {
      path = value.slice(0, hashAt);
      fragment = value.slice(hashAt);
    }
    if (/^[a-z][a-z0-9+.-]*:/i.test(value)) return "#";
  }

  const name = path.split("/").filter(Boolean).at(-1) ?? "";
  const numbered = /^zip-(\d+)(?:\.(?:rst|md))?$/i.exec(name);
  if (numbered) return `/zip/${Number(numbered[1])}${fragment}`;

  const draft = /^(draft-[a-z0-9][a-z0-9-]*)(?:\.(?:rst|md))?$/i.exec(name);
  if (draft) return `/draft/${draft[1]}${fragment}`;

  return value;
}

export function readerAssetUrl(zip: ZipRecord, href: string): string {
  const value = href.trim();
  if (value === "" || UNSAFE_SCHEME.test(value)) return "";

  if (/^[a-z][a-z0-9+.-]*:/i.test(value)) {
    if (!/^https?:/i.test(value)) return "";
    return safeAbsoluteUrl(value) ?? "";
  }

  if (zip.bodySource?.kind === "github-issue") {
    const issueUrl = supportedIssueUrl(zip.bodySource.url);
    if (issueUrl === null) return "";
    try {
      const resolved = new URL(value, issueUrl);
      return /^https?:$/.test(resolved.protocol) ? resolved.href : "";
    } catch {
      return "";
    }
  }

  if (!zip.githubUrl) return "";

  try {
    const source = new URL(zip.githubUrl);
    if (source.protocol !== "https:" || source.hostname !== "github.com") return "";
    const parts = source.pathname.split("/").filter(Boolean);
    if (parts.length < 5 || parts[2] !== "blob") return "";
    const [owner, repo, , revision, ...sourceParts] = parts;
    const rawSource = new URL(
      `https://raw.githubusercontent.com/${owner}/${repo}/${revision}/${sourceParts.join("/")}`,
    );
    const resolved = new URL(value, rawSource);
    const repositoryPrefix = `/${owner}/${repo}/${revision}/`;
    return resolved.pathname.startsWith(repositoryPrefix) ? resolved.href : "";
  } catch {
    return "";
  }
}
