import Link from "next/link";
import type { ZipRecord } from "../lib/types";
import { zipHref } from "../lib/zipHref";
import styles from "./ZipRail.module.css";

function statusLabel(zip: ZipRecord): string {
  return zip.status[0]?.label ?? zip.statusRaw;
}

export function ZipRail({ title, zips }: { title: string; zips: ZipRecord[] }) {
  if (zips.length === 0) return null;
  const headingId = `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}-heading`;
  return (
    <section className={styles.section} aria-labelledby={headingId}>
      <h2 id={headingId} className={styles.heading}>
        {title}
      </h2>
      <ul className={styles.rail}>
        {zips.map((zip) => (
          <li key={zip.id} className={styles.item}>
            <Link className={styles.card} href={zipHref(zip)}>
              <span className={styles.number}>{zip.number}</span>
              <span className={styles.title}>{zip.title}</span>
              <span className={styles.status}>{statusLabel(zip)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
