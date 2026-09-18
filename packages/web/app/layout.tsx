import type { ReactNode } from "react";
import { Footer } from "../components/Footer";
import { loadIndex } from "../lib/loadIndex";
import "./globals.css";
import styles from "./layout.module.css";

export const metadata = {
  title: "ZIP.tools",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  const index = loadIndex();
  return (
    <html lang="en">
      <body className={styles.body}>
        <header className={styles.header}>ZIP.tools</header>
        <main className={styles.main}>{children}</main>
        <Footer snapshot={index.snapshot} />
      </body>
    </html>
  );
}
