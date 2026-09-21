"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { ZipRecord } from "../lib/types";
import { HeaderSearch } from "./HeaderSearch";
import { ReadingListBadge } from "./ReadingListButton";
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
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => setMenuOpen(false), [pathname]);

  function current(href: string): "page" | undefined {
    if (href === "/") return pathname === href ? "page" : undefined;
    return pathname === href || pathname.startsWith(`${href}/`) ? "page" : undefined;
  }

  return (
    <>
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
        <div className={styles.search}>
          <HeaderSearch zips={zips} />
        </div>
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
              Browse <span className={styles.count}>{zipCount}</span>
            </Link>
            <Link className={styles.navLink} href="/zips?kind=draft" aria-label="Drafts">
              Drafts <span className={styles.count}>{draftCount}</span>
            </Link>
            <Link className={styles.navLink} href="/graph" aria-current={current("/graph")}>
              Graph
            </Link>
            <Link className={styles.navLink} href="/list" aria-current={current("/list")}>
              Reading List <ReadingListBadge />
            </Link>
          </div>
          {nus.length > 0 ? (
            <div className={styles.nuLinks} aria-label="Network upgrades">
              {nus.map((nu) => (
                <Link
                  key={nu.id}
                  className={styles.nuLink}
                  href={nu.href}
                  aria-current={current(nu.href)}
                >
                  {nu.id}
                </Link>
              ))}
            </div>
          ) : null}
        </nav>
      </header>
    </>
  );
}
