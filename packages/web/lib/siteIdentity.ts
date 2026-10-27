import { SITE_DESCRIPTION } from "./pageMetadata";
import { SITE_NAME, SITE_URL, REPOSITORY } from "./siteInfo";

export const siteIdentity = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite", "@id": `${SITE_URL}/#website`, name: SITE_NAME, url: SITE_URL,
      description: SITE_DESCRIPTION,
      inLanguage: "en", isAccessibleForFree: true,
      about: { "@type": "Thing", name: "Zcash Improvement Proposals", sameAs: "https://github.com/zcash/zips" },
      author: { "@id": `${SITE_URL}/#maintainer` },
    },
    {
      "@type": "SoftwareApplication", name: SITE_NAME, url: SITE_URL, applicationCategory: "ReferenceApplication",
      operatingSystem: "Web browser", isAccessibleForFree: true, codeRepository: REPOSITORY,
      description: "Independent open-source explorer for Zcash proposals, drafts, network upgrades and citations.",
      author: { "@id": `${SITE_URL}/#maintainer` },
    },
    { "@type": "Person", "@id": `${SITE_URL}/#maintainer`, name: "megabyte0x", url: "https://github.com/megabyte0x", sameAs: ["https://github.com/megabyte0x"] },
  ],
};
