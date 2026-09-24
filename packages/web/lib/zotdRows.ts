import type { ZipOfTheDayZip } from "./zipOfTheDay";

export type ZotdRow =
  | { label: "Category" | "Created"; kind: "text"; text: string }
  | { label: "Owners"; kind: "owners"; owners: ZipOfTheDayZip["owners"] }
  | { label: "Discussions"; kind: "link"; href: string }
  | { label: "Links"; kind: "links"; links: { href: string; label: string }[] };

/** Only the rows that have something to show. */
export function zotdRows(zip: ZipOfTheDayZip): ZotdRow[] {
  const rows: ZotdRow[] = [];
  if (zip.category) rows.push({ label: "Category", kind: "text", text: zip.category });
  if (zip.owners.length > 0) rows.push({ label: "Owners", kind: "owners", owners: zip.owners });
  if (zip.created) rows.push({ label: "Created", kind: "text", text: zip.created });
  if (zip.discussionsTo) rows.push({ label: "Discussions", kind: "link", href: zip.discussionsTo });
  const links = [
    { href: zip.officialUrl, label: "Official" },
    { href: zip.githubUrl, label: "GitHub" },
  ].filter((link) => link.href);
  if (links.length > 0) rows.push({ label: "Links", kind: "links", links });
  return rows;
}
