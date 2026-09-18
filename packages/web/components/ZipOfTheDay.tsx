"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ZipRecord } from "../lib/types";
import { zipHref } from "../lib/zipHref";
import type { ZipOfTheDayZip } from "../lib/zipOfTheDay";
import styles from "./ZipOfTheDay.module.css";

function ownerLabel(owner: ZipOfTheDayZip["owners"][number]): string {
  return owner.email ? `${owner.name} <${owner.email}>` : owner.name;
}

function statusLabel(zip: ZipOfTheDayZip): string {
  return zip.status.map((entry) => entry.label).join(", ") || zip.statusRaw;
}

export function ZipOfTheDay({
  zip,
  numbered,
}: {
  zip: ZipOfTheDayZip | null;
  numbered: Pick<ZipRecord, "number" | "slug">[];
}) {
  const router = useRouter();
  if (zip == null) return null;

  const others = numbered.filter(
    (candidate) => candidate.number != null && candidate.number !== zip.number,
  );

  function onRandom() {
    if (others.length === 0) return;
    const pick = others[Math.floor(Math.random() * others.length)];
    if (pick) router.push(zipHref(pick));
  }

  return (
    <section className={styles.section} aria-labelledby="zip-of-the-day-heading">
      <div className={styles.header}>
        <h2 id="zip-of-the-day-heading" className={styles.heading}>
          ZIP of the day
        </h2>
        {numbered.length > 1 ? (
          <button className={styles.random} type="button" onClick={onRandom}>
            Random ZIP
          </button>
        ) : null}
      </div>
      <p className={styles.title}>
        <Link className={styles.link} href={zipHref(zip)}>
          {zip.number != null ? `ZIP ${zip.number}` : zip.slug}: {zip.title}
        </Link>
      </p>
      <table className={styles.table}>
        <tbody>
          <tr>
            <th scope="row">Status</th>
            <td>{statusLabel(zip)}</td>
          </tr>
          <tr>
            <th scope="row">Category</th>
            <td>{zip.category ?? ""}</td>
          </tr>
          <tr>
            <th scope="row">Owners</th>
            <td>{zip.owners.map(ownerLabel).join(", ")}</td>
          </tr>
          <tr>
            <th scope="row">Created</th>
            <td>{zip.created ?? ""}</td>
          </tr>
          <tr>
            <th scope="row">Discussions</th>
            <td>
              {zip.discussionsTo ? (
                <a className={styles.link} href={zip.discussionsTo}>
                  {zip.discussionsTo}
                </a>
              ) : (
                ""
              )}
            </td>
          </tr>
          <tr>
            <th scope="row">Links</th>
            <td>
              {[
                { href: zip.officialUrl, label: "Official" },
                { href: zip.githubUrl, label: "GitHub" },
              ]
                .filter((link) => link.href)
                .map((link, index, links) => (
                  <span key={link.label}>
                    {index > 0 && links.length > 1 ? " · " : null}
                    <a className={styles.link} href={link.href}>
                      {link.label}
                    </a>
                  </span>
                ))}
            </td>
          </tr>
        </tbody>
      </table>
    </section>
  );
}
