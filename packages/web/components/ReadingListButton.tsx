"use client";

import { useEffect, useState } from "react";
import {
  READING_LIST_KEY,
  addToReadingList,
  parseReadingList,
  removeFromReadingList,
} from "../lib/readingList";
import type { ZipRecord } from "../lib/types";
import { zipHref } from "../lib/zipHref";

function loadList(): { items: ReturnType<typeof parseReadingList>; unavailable: boolean } {
  try {
    return { items: parseReadingList(localStorage.getItem(READING_LIST_KEY)), unavailable: false };
  } catch {
    return { items: [], unavailable: true };
  }
}

export function ReadingListBadge() {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    setCount(loadList().items.length);
  }, []);

  if (count == null || count === 0) return null;
  return <span> {count}</span>;
}

export function ReadingListButton({
  zip,
}: {
  zip: Pick<ZipRecord, "id" | "title" | "number" | "slug">;
}) {
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const { items, unavailable } = loadList();
    if (unavailable) return;
    setSaved(items.some((item) => item.id === zip.id));
  }, [zip.id]);

  function toggle() {
    const { items, unavailable } = loadList();
    if (unavailable) return;
    const next = saved
      ? removeFromReadingList(items, zip.id)
      : addToReadingList(items, {
          id: zip.id,
          title: zip.title,
          href: zipHref(zip),
        });
    try {
      localStorage.setItem(READING_LIST_KEY, JSON.stringify(next));
      setSaved(!saved);
    } catch {
      // Bookmark no-ops when storage cannot be written.
    }
  }

  return (
    <button type="button" aria-pressed={saved} onClick={toggle}>
      {saved ? "Bookmarked" : "Bookmark"}
    </button>
  );
}
