import Link from "next/link";
import type { ZipRecord } from "../lib/types";
import { HeaderSearch } from "./HeaderSearch";
import { ReadingListBadge } from "./ReadingListButton";
import styles from "./SiteHeader.module.css";

export function SiteHeader({
  zipCount,
  draftCount,
  nus,
  zips,
}: {
  zipCount: number;
  draftCount: number;
  nus: { id: string; href: string }[];
  zips: ZipRecord[];
}) {
  return (
    <header className={styles.header}>
      <Link className={styles.wordmark} href="/">
        ZIP.tools
      </Link>
      <nav className={styles.nav} aria-label="Site">
        <Link className={styles.link} href="/list">
          Reading List
          <ReadingListBadge />
        </Link>
        <Link className={styles.count} href="/zips">
          <span className={styles.countLabel}>ZIPs</span>
          <span className={styles.countNum}>{zipCount}</span>
        </Link>
        <Link className={styles.count} href="/zips?kind=draft">
          <span className={styles.countLabel}>Drafts</span>
          <span className={styles.countNum}>{draftCount}</span>
        </Link>
        <Link className={styles.link} href="/graph">
          Graph
        </Link>
        {nus.map((nu) => (
          <Link key={nu.id} className={styles.nu} href={nu.href}>
            {nu.id}
          </Link>
        ))}
      </nav>
      <HeaderSearch zips={zips} />
    </header>
  );
}
