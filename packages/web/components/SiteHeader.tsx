import Link from "next/link";
import type { ZipRecord } from "../lib/types";
import { HeaderSearch } from "./HeaderSearch";
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
        </Link>
        <Link className={styles.link} href="/zips">
          ZIPs {zipCount}
        </Link>
        <Link className={styles.link} href="/zips?kind=draft">
          Drafts {draftCount}
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
