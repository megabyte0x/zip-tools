"use client";

import { Bookmark } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  READING_LIST_KEY,
  parseReadingList,
  readingListIdentity,
  removeFromReadingList,
  shareReadingList,
  type ReadingListItem,
} from "../../lib/readingList";
import { StatusPills } from "../../components/StatusPill";
import styles from "./page.module.css";

export default function ReadingListPage() {
  const [items, setItems] = useState<ReadingListItem[]>([]);
  const [unavailable, setUnavailable] = useState(false);
  const [copyMessage, setCopyMessage] = useState("");

  useEffect(() => {
    try {
      setItems(parseReadingList(localStorage.getItem(READING_LIST_KEY)));
    } catch {
      setUnavailable(true);
      setItems([]);
    }
  }, []);

  function persist(next: ReadingListItem[]) {
    try {
      localStorage.setItem(READING_LIST_KEY, JSON.stringify(next));
      setItems(next);
    } catch {
      setUnavailable(true);
    }
  }

  async function copyShare() {
    const text = shareReadingList(location.origin, items);
    try {
      await navigator.clipboard.writeText(text);
      setCopyMessage("Copied list links.");
    } catch {
      setCopyMessage("Could not copy list links. Check clipboard access and try again.");
    }
  }

  if (items.length === 0) {
    return (
      <div className={styles.page}>
        <h1 className={styles.heading}>Reading List</h1>
        <div className={styles.emptyCard}>
          <Bookmark className={styles.emptyIcon} aria-hidden="true" />
          <p className={styles.emptyTitle}>Nothing saved yet</p>
          <p className={styles.empty}>
            Bookmark any ZIP to save it here. Bookmarks stay in this browser.
          </p>
          {unavailable ? <p className={styles.empty}>Storage is unavailable.</p> : null}
          <Link className={styles.browse} href="/zips">
            Browse ZIPs
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.heading}>Reading List</h1>
      <div className={styles.shareBlock}>
        <button className={styles.share} type="button" onClick={copyShare}>
          Copy list links
        </button>
        <p className={styles.shareHelp}>Copy the proposal links as one newline-separated list.</p>
        <p className={styles.copyFeedback} role="status" aria-live="polite">{copyMessage}</p>
      </div>
      <ul className={styles.list}>
        {items.map((item) => (
          <li key={item.id} className={styles.item}>
            <div className={styles.details}>
              <span className={styles.identity}>{readingListIdentity(item)}</span>
              {item.statuses?.length ? <StatusPills labels={item.statuses} /> : null}
              <Link className={styles.link} href={item.href}>
                {item.title}
              </Link>
            </div>
            <button
              className={styles.remove}
              type="button"
              onClick={() => persist(removeFromReadingList(items, item.id))}
            >
              Remove
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
