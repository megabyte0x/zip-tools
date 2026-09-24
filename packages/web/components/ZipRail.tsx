import Link from "next/link";
import { formatDay } from "../lib/recent";
import type { ZipRecord } from "../lib/types";
import { zipHref } from "../lib/zipHref";
import { zipIdentityLabel } from "../lib/zipIdentity";
import { RailScroller } from "./RailScroller";
import { Badge } from "./ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import styles from "./ZipRail.module.css";

function statusLabel(zip: ZipRecord): string {
  return zip.status.map((entry) => entry.label).join(", ") || zip.statusRaw;
}

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
                      <CardDescription className="text-primary">
                        {zipIdentityLabel(zip)}
                        {created ? (
                          <time className={styles.date} dateTime={zip.created ?? undefined}>
                            {created}
                          </time>
                        ) : null}
                      </CardDescription>
                      <CardTitle className={styles.title}>{zip.title}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Badge className={styles.status} variant="outline">
                        {statusLabel(zip)}
                      </Badge>
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
