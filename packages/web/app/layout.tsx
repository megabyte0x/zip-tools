import type { ReactNode } from "react";
import { AppShell } from "../components/AppShell";
import { Footer } from "../components/Footer";
import { SiteHeader } from "../components/SiteHeader";
import { headerModel } from "../lib/headerModel";
import { loadIndex } from "../lib/loadIndex";
import "./globals.css";
import styles from "./layout.module.css";

export const metadata = {
  title: "ZIP.tools",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  const index = loadIndex();
  const model = headerModel(index);
  const zips = index.zips.map((zip) => ({ ...zip, body: null }));
  return (
    <html lang="en">
      <body className={styles.body}>
        <SiteHeader
          zipCount={model.zipCount}
          draftCount={model.draftCount}
          nus={model.nus}
          zips={zips}
        />
        <AppShell footer={<Footer snapshot={index.snapshot} />}>{children}</AppShell>
      </body>
    </html>
  );
}
