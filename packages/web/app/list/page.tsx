"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  READING_LIST_KEY,
  parseReadingList,
  removeFromReadingList,
  shareReadingList,
  type ReadingListItem,
} from "../../lib/readingList";
import styles from "./page.module.css";

export default function ReadingListPage() {
  const [items, setItems] = useState<ReadingListItem[]>([]);
  const [unavailable, setUnavailable] = useState(false);
  const [copied, setCopied] = useState(false);

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
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  if (items.length === 0) {
    return (
      <div className={styles.page}>
        <h1 className={styles.heading}>Reading List</h1>
        <p className={styles.empty}>Bookmarks stay in this browser.</p>
        {unavailable ? <p className={styles.empty}>Storage is unavailable.</p> : null}
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.heading}>Reading List</h1>
      <button className={styles.share} type="button" onClick={copyShare}>
        {copied ? "Copied" : "Share"}
      </button>
      <ul className={styles.list}>
        {items.map((item) => (
          <li key={item.id} className={styles.item}>
            <Link className={styles.link} href={item.href}>
              {item.title}
            </Link>
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
