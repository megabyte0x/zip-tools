"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { showHeaderSearch } from "../lib/headerModel";
import type { ZipRecord } from "../lib/types";
import { HeaderSearch } from "./HeaderSearch";
import { ReadingListBadge } from "./ReadingListButton";
import styles from "./SiteHeader.module.css";

function SearchParamsSync({ onChange }: { onChange: (query: string) => void }) {
  const searchParams = useSearchParams();

  useEffect(() => onChange(searchParams.toString()), [onChange, searchParams]);

  return null;
}

export function SiteHeader({
  browseCount,
  draftCount,
  zips,
}: {
  browseCount: number;
  draftCount: number;
  nus: { id: string; href: string }[];
  zips: ZipRecord[];
}) {
  const pathname = usePathname();
  const [query, setQuery] = useState("");
  const draftsCurrent = pathname === "/zips" && new URLSearchParams(query).get("kind") === "draft";
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => setMenuOpen(false), [pathname, query]);

  function current(href: string): "page" | undefined {
    if (href === "/") return pathname === href ? "page" : undefined;
    if (href === "/zips" && draftsCurrent) return undefined;
    return pathname === href || pathname.startsWith(`${href}/`) ? "page" : undefined;
  }

  return (
    <>
      <Suspense fallback={null}>
        <SearchParamsSync onChange={setQuery} />
      </Suspense>
      <a className={styles.skipLink} href="#main-content">
        Skip to content
      </a>
      <header className={styles.header}>
        <Link className={styles.wordmark} href="/" aria-current={current("/")}>
          ZIP.tools
        </Link>
        <button
          className={styles.menuButton}
          type="button"
          aria-expanded={menuOpen}
          aria-controls="site-navigation"
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          onClick={() => setMenuOpen((open) => !open)}
        >
          {menuOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
        </button>
        {showHeaderSearch(pathname) ? (
          <div className={styles.search}>
            <HeaderSearch zips={zips} />
          </div>
        ) : (
          <div className={styles.search} aria-hidden="true" />
        )}
        <nav
          id="site-navigation"
          className={`${styles.nav} ${menuOpen ? styles.navOpen : ""}`}
          aria-label="Site"
        >
          <div className={styles.primaryLinks}>
            <Link
              className={styles.navLink}
              href="/zips"
              aria-label="Browse"
              aria-current={current("/zips")}
            >
              Browse <span className={styles.count}>{browseCount}</span>
            </Link>
            <Link
              className={styles.navLink}
              href="/zips?kind=draft"
              aria-label="Drafts"
              aria-current={draftsCurrent ? "page" : undefined}
            >
              Drafts <span className={styles.count}>{draftCount}</span>
            </Link>
            <Link className={styles.navLink} href="/graph" aria-current={current("/graph")}>
              Graph
            </Link>
            <Link className={styles.navLink} href="/list" aria-current={current("/list")}>
              Reading List <ReadingListBadge />
            </Link>
          </div>
        </nav>
      </header>
    </>
  );
}
