"use client";

import { Bookmark } from "lucide-react";
import { useEffect, useState } from "react";
import {
  READING_LIST_KEY,
  addToReadingList,
  parseReadingList,
  removeFromReadingList,
} from "../lib/readingList";
import type { ZipRecord } from "../lib/types";
import { zipIdentityLabel } from "../lib/zipIdentity";
import { zipHref } from "../lib/zipHref";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";

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
  return (
    <Badge variant="secondary" className="ml-1">
      {count}
    </Badge>
  );
}

export function ReadingListButton({
  zip,
}: {
  zip: Pick<ZipRecord, "id" | "title" | "number" | "slug" | "status">;
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
          identity: zipIdentityLabel(zip),
          statuses: [...new Set(zip.status.map((entry) => entry.label))],
        });
    try {
      localStorage.setItem(READING_LIST_KEY, JSON.stringify(next));
      setSaved(!saved);
    } catch {
      // Bookmark no-ops when storage cannot be written.
    }
  }

  return (
    <Button
      type="button"
      size="icon-lg"
      className="size-11"
      variant={saved ? "default" : "outline"}
      aria-label={saved ? "Bookmarked" : "Bookmark"}
      title={saved ? "Bookmarked" : "Bookmark"}
      aria-pressed={saved}
      onClick={toggle}
    >
      <Bookmark className="size-5" fill={saved ? "currentColor" : "none"} aria-hidden="true" />
    </Button>
  );
}
