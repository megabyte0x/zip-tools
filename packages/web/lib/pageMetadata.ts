import type { Metadata } from "next";
import type { ZipRecord } from "./types.ts";
import { zipIdentityLabel } from "./zipIdentity.ts";
import { SITE_NAME, SITE_URL } from "./siteInfo";
import { crawlPolicy } from "./seo";

export { SITE_NAME } from "./siteInfo";
export const SITE_DESCRIPTION =
  "Read, search, and map Zcash Improvement Proposals from a pinned snapshot of the ZIP repository.";
const DESCRIPTION_LIMIT = 200;
const READ_MORE = `Read the full text and citation graph on ${SITE_NAME}.`;
export const DEFAULT_IMAGE = { url: "/og/site.png", width: 1200, height: 630, alt: `${SITE_NAME} — Zcash Improvement Proposals` };

export function rootMetadata(): Metadata {
  return {
    metadataBase: new URL(SITE_URL),
    title: { default: `${SITE_NAME} — Zcash Improvement Proposals`, template: `%s · ${SITE_NAME}` },
    description: SITE_DESCRIPTION,
    alternates: { canonical: "/", types: { "text/markdown": "/index.md" } },
    other: { "is-agentic-site-type": "content" },
    robots: { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1, "max-video-preview": -1 } },
    openGraph: { siteName: SITE_NAME, type: "website", title: SITE_NAME, description: SITE_DESCRIPTION, url: SITE_URL, images: [DEFAULT_IMAGE] },
    twitter: { card: "summary_large_image", title: SITE_NAME, description: SITE_DESCRIPTION, images: [DEFAULT_IMAGE] },
  };
}

export function zipPageTitle(zip: Pick<ZipRecord, "number" | "slug" | "title">, part = 1): string {
  return `${zipIdentityLabel(zip)}: ${zip.title}${part > 1 ? ` — Part ${part}` : ""}`;
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: "\"", apos: "'", nbsp: " " };

function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, entity: string) => {
    if (entity[0] === "#") {
      const code = entity[1].toLowerCase() === "x" ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10);
      return Number.isInteger(code) && code >= 0 && code <= 0x10ffff ? String.fromCodePoint(code) : match;
    }
    return ENTITIES[entity.toLowerCase()] ?? match;
  });
}

/** Plain text of the first paragraph under the proposal's "Abstract" heading, if it has one. */
export function zipAbstract(zip: Pick<ZipRecord, "body" | "bodyFormat">): string | null {
  const body = zip.body ?? "";
  let paragraph: string | undefined;
  if (zip.bodyFormat === "html") {
    const heading = /<h([1-6])[^>]*>(?:\s|<[^>]+>)*Abstract(?:\s|<[^>]+>)*<\/h\1>/i.exec(body);
    if (!heading) return null;
    const rest = body.slice(heading.index + heading[0].length);
    const match = /^\s*<p[^>]*>([\s\S]*?)<\/p>/i.exec(rest);
    paragraph = match?.[1]
      ?.replace(/<a[^>]*class="footnote-ref"[^>]*>[\s\S]*?<\/a>/gi, "")
      .replace(/<[^>]+>/g, "");
    if (paragraph != null) paragraph = decodeEntities(paragraph);
  } else if (zip.bodyFormat === "markdown") {
    const heading = /^#{1,6}[ \t]*Abstract[ \t]*$/im.exec(body);
    if (!heading) return null;
    paragraph = body
      .slice(heading.index + heading[0].length)
      .replace(/^\s+/, "")
      .split(/\n\s*\n/)[0]
      ?.replace(/\[\^[^\]]+\]/g, "")
      .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
      .replace(/[*_`]+/g, "");
    if (paragraph?.startsWith("#")) return null;
  }
  const text = paragraph?.replace(/\s+/g, " ").replace(/\s+([.,;:])/g, "$1").trim();
  return text ? text : null;
}

function truncate(text: string): string {
  if (text.length <= DESCRIPTION_LIMIT) return text;
  const cut = text.slice(0, DESCRIPTION_LIMIT - 1);
  const space = cut.lastIndexOf(" ");
  return `${(space > DESCRIPTION_LIMIT * 0.6 ? cut.slice(0, space) : cut).replace(/[\s,;:.]+$/, "")}…`;
}

export function zipPageDescription(
  zip: Pick<ZipRecord, "status" | "statusRaw" | "category" | "owners"> & Partial<Pick<ZipRecord, "body" | "bodyFormat">>,
): string {
  const status = [...new Set(zip.status.map((entry) => entry.label))].join(", ") || zip.statusRaw.trim();
  const lead = [status, zip.category, "ZIP"].filter(Boolean).join(" ");
  // Search results and link previews show the proposal's own summary when it has one.
  const abstract = zipAbstract({ body: zip.body ?? null, bodyFormat: zip.bodyFormat });
  if (abstract) return truncate(`${lead}: ${abstract}`);
  const owners = zip.owners.map((owner) => owner.name).join(", ");
  return truncate(`${lead}${owners ? ` by ${owners}` : ""}. ${READ_MORE}`);
}

/** Build-time social card for a proposal; see scripts/og-images.tsx. */
export function ogImagePath(zip: Pick<ZipRecord, "id">): string {
  return `/og/${encodeURIComponent(zip.id)}.png`;
}

export function pageMetadata({ title, description, path = "/", image }: { title: string; description: string; path?: string; image?: string }): Metadata {
  const url = new URL(path, SITE_URL);
  const { canonical, noindex } = crawlPolicy(url);
  const markdown = `${url.pathname === "/" ? "/index" : url.pathname}.md${url.search}`;
  return {
    title,
    description,
    ...(noindex ? { robots: { index: false, follow: true } } : {}),
    alternates: { canonical, types: { "text/markdown": markdown } },
    openGraph: { siteName: SITE_NAME, type: image ? "article" : "website", title, description, url: canonical, images: [image ? { url: image, width: 1200, height: 630, alt: title } : DEFAULT_IMAGE] },
    twitter: { card: "summary_large_image", title, description, images: [{ url: image ?? DEFAULT_IMAGE.url, alt: image ? title : DEFAULT_IMAGE.alt }] },
  };
}
