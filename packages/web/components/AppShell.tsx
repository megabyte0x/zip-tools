"use client";

import { usePathname } from "next/navigation";
import { type ReactNode, useEffect } from "react";
import styles from "../app/layout.module.css";

export function AppShell({
  children,
  footer,
}: {
  children: ReactNode;
  footer: ReactNode;
}) {
  const graph = usePathname() === "/graph";

  useEffect(() => {
    document.body.classList.toggle(styles.bodyGraph, graph);
    return () => document.body.classList.remove(styles.bodyGraph);
  }, [graph]);

  return (
    <>
      <main className={graph ? styles.mainGraph : styles.main}>{children}</main>
      {graph ? null : footer}
    </>
  );
}
