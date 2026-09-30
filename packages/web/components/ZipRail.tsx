import Link from "next/link";
import { formatDay } from "../lib/recent";
import type { ZipRecord } from "../lib/types";
import { zipHref } from "../lib/zipHref";
import { zipIdentityLabel } from "../lib/zipIdentity";
import { RailScroller } from "./RailScroller";
import { StatusPills } from "./StatusPill";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import styles from "./ZipRail.module.css";

export function ZipRail({
  title,
  zips,
  showCreated = false,
}: {
  title: string;
  zips: ZipRecord[];
  showCreated?: boolean;
}) {
  if (zips.length === 0) return null;
  const headingId = `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}-heading`;
  return (
    <section className={styles.section} aria-labelledby={headingId}>
      <h2 id={headingId} className={styles.heading}>
        {title}
      </h2>
      <RailScroller label={title}>
        <ul className={styles.rail}>
          {zips.map((zip) => {
            const created = showCreated ? formatDay(zip.created) : null;
            return (
              <li key={zip.id} className={styles.item}>
                <Link href={zipHref(zip)} className={styles.cardLink}>
                  <Card size="sm" className={styles.card}>
                    <CardHeader className="gap-1">
                      <CardDescription className={`${styles.meta} text-primary`}>
                        <span className={styles.identity}>{zipIdentityLabel(zip)}</span>
                        {created ? (
                          <time className={styles.date} dateTime={zip.created ?? undefined}>
                            {created}
                          </time>
                        ) : null}
                      </CardDescription>
                      <CardTitle className={styles.title}>{zip.title}</CardTitle>
                    </CardHeader>
                    <CardContent className={styles.status}>
                      <StatusPills labels={zip.status.map((entry) => entry.label)} />
                    </CardContent>
                  </Card>
                </Link>
              </li>
            );
          })}
        </ul>
      </RailScroller>
    </section>
  );
}
