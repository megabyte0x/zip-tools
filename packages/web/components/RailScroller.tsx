"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import styles from "./ZipRail.module.css";

/** Horizontal rail with prev/next buttons and edge fades that track the scroll position. */
export function RailScroller({ label, children }: { label: string; children: ReactNode }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: true, end: false });

  const measure = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;
    const max = track.scrollWidth - track.clientWidth;
    setEdges({ start: track.scrollLeft <= 2, end: track.scrollLeft >= max - 2 });
  }, []);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    measure();
    track.addEventListener("scroll", measure, { passive: true });
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    observer?.observe(track);
    return () => {
      track.removeEventListener("scroll", measure);
      observer?.disconnect();
    };
  }, [measure]);

  function page(direction: -1 | 1) {
    const track = trackRef.current;
    if (!track) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    track.scrollBy({ left: direction * track.clientWidth * 0.85, behavior: reduce ? "auto" : "smooth" });
  }

  const scrollable = !(edges.start && edges.end);

  return (
    <div className={styles.scroller}>
      {scrollable ? (
        <div className={styles.controls}>
          <button
            type="button"
            className={styles.arrow}
            aria-label={`Scroll ${label} back`}
            disabled={edges.start}
            onClick={() => page(-1)}
          >
            <ChevronLeft aria-hidden="true" />
          </button>
          <button
            type="button"
            className={styles.arrow}
            aria-label={`Scroll ${label} forward`}
            disabled={edges.end}
            onClick={() => page(1)}
          >
            <ChevronRight aria-hidden="true" />
          </button>
        </div>
      ) : null}
      <div
        ref={trackRef}
        className={styles.track}
        data-fade-start={!edges.start || undefined}
        data-fade-end={!edges.end || undefined}
      >
        {children}
      </div>
    </div>
  );
}
