import { SITE_URL } from "./siteInfo";

/** One policy for HTML metadata and both HTTP representations. */
export function crawlPolicy(url: URL): { canonical: string; noindex: boolean } {
  const path = url.pathname.replace(/\.md$/, "").replace(/^\/index$/, "/");
  if (path === "/zips") {
    const drafts = url.searchParams.get("kind") === "draft";
    const dedicatedListing = !url.search || (drafts && url.searchParams.size === 1);
    return { canonical: drafts ? "/zips?kind=draft" : "/zips", noindex: !dedicatedListing };
  }
  if (/^\/(zip|draft)\/[^/]+$/.test(path)) {
    const part = Number(url.searchParams.get("part") ?? 1);
    return { canonical: path + (Number.isInteger(part) && part > 1 ? `?part=${part}` : ""), noindex: false };
  }
  return { canonical: path, noindex: path === "/list" };
}

/** Redirect only the known legacy host; keep local previews on their own origin. */
export function canonicalRedirect(url: URL): URL | null {
  const target = new URL(url);
  if (target.hostname === "zip-tools-web.harpocrates.workers.dev") {
    target.protocol = "https:";
    target.host = new URL(SITE_URL).host;
  }
  const proposal = /^\/zip\/(?:zip-)?(\d+)(\.md)?$/i.exec(target.pathname);
  if (proposal) target.pathname = `/zip/${BigInt(proposal[1])}${proposal[2] ?? ""}`;
  return target.href === url.href ? null : target;
}
