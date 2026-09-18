export const READING_LIST_KEY = "zip-tools.reading-list";

export type ReadingListItem = { id: string; title: string; href: string };

function isReadingListItem(value: unknown): value is ReadingListItem {
  if (value == null || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.id === "string" &&
    typeof item.title === "string" &&
    typeof item.href === "string"
  );
}

export function parseReadingList(raw: string | null): ReadingListItem[] {
  if (raw == null) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isReadingListItem);
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
