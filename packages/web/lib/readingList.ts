export const READING_LIST_KEY = "zip-tools.reading-list";

export type ReadingListItem = {
  id: string;
  title: string;
  href: string;
  identity?: string;
  statuses?: string[];
};

function isReadingListItem(value: unknown): value is Pick<ReadingListItem, "id" | "title" | "href"> & Record<string, unknown> {
  if (value == null || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.id === "string" &&
    typeof item.title === "string" &&
    typeof item.href === "string"
  );
}

function normalizeReadingListItem(value: unknown): ReadingListItem | null {
  if (!isReadingListItem(value)) return null;
  const item: ReadingListItem = { id: value.id, title: value.title, href: value.href };
  if (typeof value.identity === "string" && value.identity.trim()) item.identity = value.identity;
  if (Array.isArray(value.statuses) && value.statuses.every((status) => typeof status === "string")) {
    item.statuses = value.statuses;
  }
  return item;
}

export function parseReadingList(raw: string | null): ReadingListItem[] {
  if (raw == null) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((item) => {
      const normalized = normalizeReadingListItem(item);
      return normalized ? [normalized] : [];
    });
  } catch {
    return [];
  }
}

export function addToReadingList(
  items: ReadingListItem[],
  item: ReadingListItem,
  max = 200,
): ReadingListItem[] {
  return [item, ...items.filter((entry) => entry.id !== item.id)].slice(0, max);
}

export function removeFromReadingList(items: ReadingListItem[], id: string): ReadingListItem[] {
  return items.filter((item) => item.id !== id);
}

export function shareReadingList(origin: string, items: ReadingListItem[]): string {
  return items.map((item) => origin + item.href).join("\n");
}

export function readingListIdentity(item: ReadingListItem): string {
  if (item.identity) return item.identity;
  try {
    const url = new URL(item.href, "https://zip.tools");
    if (url.origin !== "https://zip.tools") return "Saved proposal";
    const zip = url.pathname.match(/^\/zip\/(\d+)\/?$/);
    if (zip) return `ZIP ${zip[1]}`;
    const draft = url.pathname.match(/^\/draft\/(draft-[a-z0-9][a-z0-9-]*)\/?$/i);
    if (draft) return `Draft ${draft[1].slice("draft-".length)}`;
  } catch {
    // Malformed legacy URLs have no locally verifiable identity.
  }
  return "Saved proposal";
}
