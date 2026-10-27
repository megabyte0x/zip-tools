import { partHref } from "../lib/agentDocuments";
import { ogImagePath, zipPageDescription, zipPageTitle } from "../lib/pageMetadata";
import { SITE_NAME, SITE_URL } from "../lib/siteInfo";
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
        isBasedOn: zip.bodySource?.kind === "github-issue" ? zip.bodySource.url : zip.githubUrl,
        image: SITE_URL + ogImagePath(zip),
        ...(zip.created && /^\d{4}-\d{2}-\d{2}$/.test(zip.created) ? { datePublished: zip.created } : {}),
        mainEntityOfPage: url,
        isPartOf: { "@id": `${SITE_URL}/#website` },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: SITE_NAME, item: SITE_URL },
          { "@type": "ListItem", position: 2, name: zip.number === null ? "Draft ZIPs" : "Browse ZIPs", item: `${SITE_URL}/zips${zip.number === null ? "?kind=draft" : ""}` },
          { "@type": "ListItem", position: 3, name: headline, item: url },
        ],
      },
    ],
  };
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }} />;
}
