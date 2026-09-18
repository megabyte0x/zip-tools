"use client";

import { useEffect, useState } from "react";
import { activeTocId, type TocEntry } from "../lib/toc";
import styles from "./ReaderShell.module.css";

const SPY_OFFSET_PX = 96;

export function TocNav({ toc }: { toc: TocEntry[] }) {
  const [activeId, setActiveId] = useState<string | null>(toc[0]?.id ?? null);

  useEffect(() => {
    function update() {
      const headings = toc.flatMap((entry) => {
        const el = document.getElementById(entry.id);
        if (!el) return [];
        return [{ id: entry.id, top: el.getBoundingClientRect().top }];
      });
      setActiveId(activeTocId(headings, SPY_OFFSET_PX));
    }
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [toc]);

  return (
    <ol className={styles.tocList}>
      {toc.map((entry) => (
        <li key={entry.id} data-level={entry.level}>
          <a
            className={entry.id === activeId ? `${styles.tocLink} ${styles.tocLinkActive}` : styles.tocLink}
            href={`#${entry.id}`}
            aria-current={entry.id === activeId ? "true" : undefined}
          >
            {entry.text}
          </a>
        </li>
      ))}
    </ol>
  );
}
