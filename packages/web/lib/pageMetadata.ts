import type { Metadata } from "next";
import type { ZipRecord } from "./types.ts";
import { zipIdentityLabel } from "./zipIdentity.ts";

export const SITE_NAME = "ZIP.tools";
export const SITE_DESCRIPTION =
  "Read, search, and map Zcash Improvement Proposals from a pinned snapshot of the ZIP repository.";
const DESCRIPTION_LIMIT = 200;
const READ_MORE = "Read the full text and citation graph on ZIP.tools.";

export function rootMetadata(): Metadata {
  return {
    title: { default: SITE_NAME, template: `%s · ${SITE_NAME}` },
    description: SITE_DESCRIPTION,
    openGraph: { siteName: SITE_NAME, type: "website", title: SITE_NAME, description: SITE_DESCRIPTION },
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

export function pageMetadata({ title, description }: { title: string; description: string }): Metadata {
  return {
    title,
    description,
    openGraph: { siteName: SITE_NAME, type: "article", title, description },
    twitter: { card: "summary", title, description },
  };
}
