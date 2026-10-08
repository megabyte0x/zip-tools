import type { ReactNode } from "react";
import { AppShell } from "../components/AppShell";
import { Footer } from "../components/Footer";
import { SiteHeader } from "../components/SiteHeader";
import { headerModel } from "../lib/headerModel";
import { browserZip } from "../lib/browserZip";
import { loadIndex } from "../lib/loadIndex";
import { rootMetadata } from "../lib/pageMetadata";
import { siteIdentity } from "../lib/siteIdentity";
import "./globals.css";
import styles from "./layout.module.css";

export const metadata = rootMetadata();

export default function RootLayout({ children }: { children: ReactNode }) {
  const index = loadIndex();
  const model = headerModel(index);
  const zips = index.zips.map(browserZip);
  return (
    <html lang="en" className="dark">
      <body className={styles.body}>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(siteIdentity).replace(/</g, "\\u003c") }} />
        <SiteHeader
          browseCount={model.browseCount}
          draftCount={model.draftCount}
          zips={zips}
        />
        <AppShell footer={<Footer snapshot={index.snapshot} />}>{children}</AppShell>
      </body>
    </html>
  );
}
