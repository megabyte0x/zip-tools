import { SITE_URL, REPOSITORY } from "./siteInfo";

export const siteIdentity = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite", "@id": `${SITE_URL}/#website`, name: "ZIP.tools", url: SITE_URL,
      description: "Read, search, and map Zcash Improvement Proposals from a pinned snapshot of the ZIP repository.",
      inLanguage: "en", isAccessibleForFree: true,
      about: { "@type": "Thing", name: "Zcash Improvement Proposals", sameAs: "https://github.com/zcash/zips" },
      author: { "@id": `${SITE_URL}/#maintainer` },
    },
    {
      "@type": "SoftwareApplication", name: "ZIP.tools", url: SITE_URL, applicationCategory: "ReferenceApplication",
      operatingSystem: "Web browser", isAccessibleForFree: true, codeRepository: REPOSITORY,
      description: "Independent open-source explorer for Zcash proposals, drafts, network upgrades and citations.",
      author: { "@id": `${SITE_URL}/#maintainer` },
    },
    { "@type": "Person", "@id": `${SITE_URL}/#maintainer`, name: "megabyte0x", url: "https://github.com/megabyte0x", sameAs: ["https://github.com/megabyte0x"] },
  ],
};
