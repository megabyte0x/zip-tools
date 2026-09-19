import Link from "next/link";
import type { ReactNode } from "react";
import { readerMode } from "../lib/readerMode";
import { rstSourceToMarkdown } from "../lib/rstSource";
import { tocFromHtml, tocFromMarkdown, type TocEntry } from "../lib/toc";
import type { ZipRecord } from "../lib/types";
import { zipHref } from "../lib/zipHref";
import { GeneratedSummary } from "./GeneratedSummary";
import { ReadingListButton } from "./ReadingListButton";
import { TocNav } from "./TocNav";
import { ZipMeta } from "./ZipMeta";
import styles from "./ReaderShell.module.css";

function tocForZip(zip: ZipRecord): TocEntry[] {
  const mode = readerMode(zip.body, zip.bodyKind);
  if (mode === "html") return tocFromHtml(zip.body ?? "").toc;
  if (mode === "markdown") return tocFromMarkdown(zip.body ?? "");
  if (mode === "source") return tocFromMarkdown(rstSourceToMarkdown(zip.body ?? ""));
  return [];
}

function Chevron({ dir }: { dir: "prev" | "next" }) {
  const d = dir === "prev" ? "M15 18 9 12l6-6" : "M9 18l6-6-6-6";
  return (
    <svg className={styles.icon} viewBox="0 0 24 24" aria-hidden="true">
      <path
        d={d}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ReaderShell({
  zip,
  prev,
  next,
  children,
}: {
  zip: ZipRecord;
  prev: ZipRecord | null;
  next: ZipRecord | null;
  children: ReactNode;
}) {
  const toc = tocForZip(zip);
  const tocNav = toc.length > 0 ? <TocNav toc={toc} /> : null;

  return (
    <div className={styles.shell}>
      <nav className={styles.tocDesktop} aria-label="Contents">
        {tocNav ? <p className={styles.tocLabel}>Contents</p> : null}
        {tocNav}
      </nav>
      <article className={styles.article}>
        {zip.number != null ? (
          <nav className={styles.prevNext} aria-label="Adjacent ZIPs">
            {prev?.number != null ? (
              <Link
                className={styles.navBtn}
                href={zipHref(prev)}
                title={`ZIP ${prev.number}: ${prev.title}`}
              >
                <Chevron dir="prev" />
              </Link>
            ) : (
              <span className={styles.navBtnPlaceholder} />
            )}
            {next?.number != null ? (
              <Link
                className={styles.navBtn}
                href={zipHref(next)}
                title={`ZIP ${next.number}: ${next.title}`}
              >
                <Chevron dir="next" />
              </Link>
            ) : (
              <span className={styles.navBtnPlaceholder} />
            )}
          </nav>
        ) : null}
        <p className={styles.kicker}>
          {zip.number != null ? `ZIP ${zip.number}` : zip.slug}
        </p>
        <h1 className={styles.title}>{zip.title}</h1>
        {tocNav ? (
          <details className={styles.tocMobile}>
            <summary>Contents</summary>
            {tocNav}
          </details>
        ) : null}
        <GeneratedSummary id={zip.id} body={zip.body} />
        {children}
      </article>
      <aside className={styles.metaColumn}>
        <ZipMeta zip={zip} />
        <ReadingListButton zip={zip} />
      </aside>
    </div>
  );
}
