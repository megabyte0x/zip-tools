import { partHref } from "../lib/agentDocuments";
import { zipPageDescription, zipPageTitle } from "../lib/pageMetadata";
import { SITE_URL } from "../lib/siteInfo";
import type { ZipRecord } from "../lib/types";
import { zipHref } from "../lib/zipHref";

export function ProposalStructuredData({ zip, part }: { zip: ZipRecord; part: number }) {
  const url = SITE_URL + partHref(zipHref(zip), part);
  const headline = zipPageTitle(zip, part);
  const data = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "TechArticle", "@id": `${url}#article`, url, headline,
        description: zipPageDescription(zip), inLanguage: "en", isAccessibleForFree: true,
        author: zip.owners.map(({ name }) => ({ "@type": "Person", name })),
        isBasedOn: zip.githubUrl,
        mainEntityOfPage: url,
        isPartOf: { "@id": `${SITE_URL}/#website` },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "zips.tools", item: SITE_URL },
          { "@type": "ListItem", position: 2, name: zip.number === null ? "Draft ZIPs" : "Browse ZIPs", item: `${SITE_URL}/zips${zip.number === null ? "?kind=draft" : ""}` },
          { "@type": "ListItem", position: 3, name: headline, item: url },
        ],
      },
    ],
  };
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }} />;
}
