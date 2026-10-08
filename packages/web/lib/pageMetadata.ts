import type { Metadata } from "next";
import type { ZipRecord } from "./types.ts";
import { zipIdentityLabel } from "./zipIdentity.ts";
import { SITE_URL } from "./siteInfo";

export const SITE_NAME = "ZIP.tools";
export const SITE_DESCRIPTION =
  "Read, search, and map Zcash Improvement Proposals from a pinned snapshot of the ZIP repository.";
const DESCRIPTION_LIMIT = 200;
const READ_MORE = "Read the full text and citation graph on ZIP.tools.";

export function rootMetadata(): Metadata {
  return {
    metadataBase: new URL(SITE_URL),
    title: { default: `${SITE_NAME} — Zcash Improvement Proposals`, template: `%s · ${SITE_NAME}` },
    description: SITE_DESCRIPTION,
    alternates: { canonical: "/", types: { "text/markdown": "/index.md" } },
    other: { "is-agentic-site-type": "content" },
    openGraph: { siteName: SITE_NAME, type: "website", title: SITE_NAME, description: SITE_DESCRIPTION, url: SITE_URL, images: [{ url: "/opengraph-image.png", width: 1200, height: 630, alt: "ZIP.tools — Zcash Improvement Proposals" }] },
  };
}

export function zipPageTitle(zip: Pick<ZipRecord, "number" | "slug" | "title">): string {
  return `${zipIdentityLabel(zip)}: ${zip.title}`;
}

export function zipPageDescription(
  zip: Pick<ZipRecord, "status" | "statusRaw" | "category" | "owners">,
): string {
  const status = [...new Set(zip.status.map((entry) => entry.label))].join(", ") || zip.statusRaw.trim();
  const lead = [status, zip.category, "ZIP"].filter(Boolean).join(" ");
  const owners = zip.owners.map((owner) => owner.name).join(", ");
  const text = `${lead}${owners ? ` by ${owners}` : ""}. ${READ_MORE}`;
  return text.length <= DESCRIPTION_LIMIT ? text : `${text.slice(0, DESCRIPTION_LIMIT - 1).trimEnd()}…`;
}

export function pageMetadata({ title, description, path = "/" }: { title: string; description: string; path?: string }): Metadata {
  const url = new URL(path, SITE_URL);
  const markdown = `${url.pathname === "/" ? "/index" : url.pathname}.md${url.search}`;
  return {
    title,
    description,
    alternates: { canonical: path, types: { "text/markdown": markdown } },
    openGraph: { siteName: SITE_NAME, type: "article", title, description, url: path, images: [{ url: "/opengraph-image.png", width: 1200, height: 630, alt: "ZIP.tools — Zcash Improvement Proposals" }] },
    twitter: { card: "summary", title, description },
  };
}
