"use client";

import { usePathname } from "next/navigation";
import { type ReactNode } from "react";
import styles from "../app/layout.module.css";

export function AppShell({
  children,
  footer,
}: {
  children: ReactNode;
  footer: ReactNode;
}) {
  const graph = usePathname() === "/graph";

  return (
    <>
      <main id="main-content" className={graph ? styles.mainGraph : styles.main}>
        {children}
      </main>
      {graph ? null : footer}
    </>
  );
}
