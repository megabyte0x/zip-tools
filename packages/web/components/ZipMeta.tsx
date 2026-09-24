import type { ZipRecord } from "../lib/types";
import { StatusPills } from "./StatusPill";
import styles from "./ZipMeta.module.css";

export function ZipMeta({ zip }: { zip: ZipRecord }) {
  const idLabel = zip.number != null ? String(zip.number) : zip.slug;
  const links = [
    { href: zip.officialUrl, label: "Official" },
    { href: zip.githubUrl, label: "GitHub" },
    ...(zip.discussionsTo ? [{ href: zip.discussionsTo, label: "Discussions" }] : []),
  ].filter((link) => link.href);

  return (
    <dl className={styles.meta}>
      <div className={styles.item}>
        <dt className={styles.term}>ID</dt>
        <dd className={styles.value}>{idLabel}</dd>
      </div>
      <div className={styles.item}>
        <dt className={styles.term}>Status</dt>
        <dd className={styles.value}>
          <StatusPills labels={zip.status.map((entry) => entry.label)} />
        </dd>
      </div>
      <div className={styles.item}>
        <dt className={styles.term}>Category</dt>
        <dd className={styles.value}>{zip.category ?? ""}</dd>
      </div>
      <div className={styles.item}>
        <dt className={styles.term}>Owners</dt>
        <dd className={styles.value}>
          <ul className={styles.owners}>
            {zip.owners.map((owner) => (
              <li key={owner.name}>{owner.name}</li>
            ))}
          </ul>
        </dd>
      </div>
      <div className={styles.item}>
        <dt className={styles.term}>Created</dt>
        <dd className={styles.value}>{zip.created ?? ""}</dd>
      </div>
      <div className={styles.item}>
        <dt className={styles.term}>License</dt>
        <dd className={styles.value}>{zip.license ?? ""}</dd>
      </div>
      <div className={styles.item}>
        <dt className={styles.term}>Links</dt>
        <dd className={styles.value}>
          <ul className={styles.links}>
            {links.map((link) => (
              <li key={link.label}>
                <a className={styles.link} href={link.href}>
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </dd>
      </div>
    </dl>
  );
}
