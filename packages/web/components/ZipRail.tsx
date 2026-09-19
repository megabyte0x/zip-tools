import Link from "next/link";
import type { ZipRecord } from "../lib/types";
import { zipHref } from "../lib/zipHref";
import { Badge } from "./ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
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
            <Link href={zipHref(zip)} className="block h-full no-underline">
              <Card size="sm" className="h-full py-3 transition hover:ring-primary/40">
                <CardHeader className="gap-1">
                  <CardDescription className="text-primary">
                    {zip.number != null ? `ZIP ${zip.number}` : zip.slug}
                  </CardDescription>
                  <CardTitle className="text-sm leading-snug">{zip.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <Badge variant="outline">{statusLabel(zip)}</Badge>
                </CardContent>
              </Card>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
