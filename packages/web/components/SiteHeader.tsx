import Link from "next/link";
import type { ZipRecord } from "../lib/types";
import { HeaderSearch } from "./HeaderSearch";
import { ReadingListBadge } from "./ReadingListButton";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
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
      <Button variant="ghost" className="px-0 text-base font-semibold tracking-wide" asChild>
        <Link href="/">ZIP.tools</Link>
      </Button>
      <nav className={styles.nav} aria-label="Site">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/list">
            Reading List
            <ReadingListBadge />
          </Link>
        </Button>
        <Button variant="ghost" size="sm" className="h-auto py-1" asChild>
          <Link href="/zips" className="flex flex-col items-start gap-0 leading-none">
            <span className="text-[0.65rem] font-semibold tracking-widest text-muted-foreground uppercase">
              ZIPs
            </span>
            <span className="text-sm tabular-nums">{zipCount}</span>
          </Link>
        </Button>
        <Button variant="ghost" size="sm" className="h-auto py-1" asChild>
          <Link href="/zips?kind=draft" className="flex flex-col items-start gap-0 leading-none">
            <span className="text-[0.65rem] font-semibold tracking-widest text-muted-foreground uppercase">
              Drafts
            </span>
            <span className="text-sm tabular-nums">{draftCount}</span>
          </Link>
        </Button>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/graph">Graph</Link>
        </Button>
        {nus.map((nu) => (
          <Badge key={nu.id} variant="outline" asChild>
            <Link href={nu.href}>{nu.id}</Link>
          </Badge>
        ))}
      </nav>
      <HeaderSearch zips={zips} />
    </header>
  );
}
