"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ZipRecord } from "../lib/types";
import { zipHref } from "../lib/zipHref";
import type { ZipOfTheDayZip } from "../lib/zipOfTheDay";
import { formatDay } from "../lib/recent";
import { zotdRows } from "../lib/zotdRows";
import { StatusPills } from "./StatusPill";
import { Button } from "./ui/button";
import styles from "./ZipOfTheDay.module.css";

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
        <p className={styles.sub}>A new proposal every day, picked in UTC.</p>
        {numbered.length > 1 ? (
          <Button variant="outline" size="sm" type="button" onClick={onRandom}>
            Random ZIP
          </Button>
        ) : null}
      </div>
      <div className={styles.card}>
        <p className={styles.identity}>{zip.number != null ? `ZIP ${zip.number}` : zip.slug}</p>
        <p className={styles.title}>
          <Link className={styles.titleLink} href={zipHref(zip)}>
            {zip.title}
          </Link>
        </p>
        <div className={styles.status}>
          <StatusPills labels={zip.status.map((entry) => entry.label)} />
        </div>
        <dl className={styles.rows}>
          {zotdRows(zip).map((row) => (
            <div key={row.label} className={styles.row}>
              <dt>{row.label}</dt>
              <dd>
                {row.kind === "text" ? (row.label === "Created" ? formatDay(row.text) ?? row.text : row.text) : null}
                {row.kind === "owners" ? (
                  <ul className={styles.owners}>
                    {row.owners.map((owner) => (
                      <li key={owner.name}>{owner.name}</li>
                    ))}
                  </ul>
                ) : null}
                {row.kind === "link" ? (
                  <a className={styles.link} href={row.href}>
                    {row.href.replace(/^https?:\/\//, "")}
                  </a>
                ) : null}
                {row.kind === "links" ? (
                  <span className={styles.links}>
                    {row.links.map((link) => (
                      <a key={link.label} className={styles.link} href={link.href}>
                        {link.label}
                      </a>
                    ))}
                  </span>
                ) : null}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
