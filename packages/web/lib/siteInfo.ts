export const SITE_URL = "https://zip-tools-web.harpocrates.workers.dev";
export const REPOSITORY = "https://github.com/megabyte0x/zip-tools";
export const INFO_PAGES: Record<string, { title: string; paragraphs: string[] }> = {
  about: {
    title: "About ZIP.tools",
    paragraphs: [
      "ZIP.tools is an independent, open-source reference explorer for Zcash Improvement Proposals. It helps readers find proposals by number, title, owner, status, and network upgrade, then follow the citations between them. It is maintained in the megabyte0x/zip-tools GitHub repository. ZIP.tools is not the official Zcash ZIP repository and does not decide whether proposals are accepted or activated.",
      "The site serves a pinned snapshot of zcash/zips. Each proposal links to its official publication and the exact source revision used by this explorer. The footer identifies the snapshot commit and date. Some drafts come from saved GitHub issue descriptions; those are identified as issue snapshots. Long documents are divided into linked parts without summarizing or omitting the original proposal text. Always check the official source for changes after the snapshot.",
      "Public reference pages can be read as HTML or Markdown. Use the same URL with Accept: text/markdown, or append .md. The agent guide explains how to retrieve proposals, follow references, and identify source limitations. Reading the public site is free and requires no account, API key, subscription, or payment.",
    ],
  },
  contact: {
    title: "Contact and corrections",
    paragraphs: [
      "The public contact route for ZIP.tools is the issue tracker in the megabyte0x/zip-tools GitHub repository. Open an issue there to report a broken page, missing proposal text, an incorrect citation, a rendering problem, or a problem with the Markdown representation. Include the page URL, the proposal number or draft slug, the snapshot commit shown in the footer, and enough detail to reproduce the problem. GitHub may require an account to submit an issue; reading existing public issues does not require contacting a maintainer.",
      "Use the ZIP.tools tracker for problems with this explorer. Questions about the substance, acceptance, or deployment of a Zcash proposal belong in the proposal's official discussion link or the zcash/zips repository. Every proposal page links to its official source and, when supplied by its source metadata, its discussion. This distinction helps corrections reach the people who can resolve them.",
      "Do not include private keys, seed phrases, passwords, personal wallet information, or other secrets in a public issue. For sensitive reports, first ask the maintainer in the public tracker for an appropriate private contact channel without disclosing the sensitive material. No support email, office location, or response-time commitment is published by this site.",
    ],
  },
  privacy: {
    title: "Privacy and local storage",
    paragraphs: [
      "ZIP.tools provides public reference material without a user account. Reading-list bookmarks are stored in your browser's localStorage and are not uploaded as a reading list. Sharing the /list URL does not share your saved proposals. Use Copy list links to share the individual public proposal links. You can remove bookmarks through the reading-list controls or clear the site's local storage in your browser settings.",
      "Opening a proposal in a JavaScript-enabled browser sends its proposal ID to /api/views to count readership. The service hashes the connecting IP address with SHA-256, truncates that hash, and uses it with the proposal ID to suppress repeated counts for approximately 30 minutes in Cloudflare KV. The hash is derived from an IP address and should not be treated as anonymous. Aggregate daily proposal counts are stored in Cloudflare D1 and proposal-count events may be sent to Cloudflare Analytics Engine. These are used for trending proposals. Reading-list contents are not included in this request.",
      "Cloudflare hosts this site and processes network requests. Infrastructure logging and retention depend on Cloudflare and the deployment settings; this page does not promise that infrastructure logs are absent. Links to GitHub and official proposal sites take you to services with their own privacy practices. The optional generated-summary feature is currently disabled in this deployment. Questions about this site's data handling can be raised through the public repository's issue tracker without including personal or sensitive information.",
    ],
  },
  docs: {
    title: "Agent guide: reading ZIP.tools",
    paragraphs: [
      "When to use this site: retrieve a numbered Zcash Improvement Proposal, inspect a draft, find the proposals grouped under a network upgrade, or follow proposal citations from a pinned source snapshot. Use /zips for the proposal index, /zip/NUMBER for numbered proposals, /draft/SLUG for drafts, and /nu/ID for an upgrade. This is a reference service, not a wallet, transaction broadcaster, consensus authority, or live blockchain-data source.",
      "Send GET with Accept: text/markdown to any public reference URL for Markdown. Appending .md also selects Markdown without a special header. Requests for HTML keep the normal website. Long documents have numbered parts: follow the part links in the response and preserve the ?part=N query when citing a part. These are parts of the same proposal, not different source revisions. Follow citation and footnote links across parts to collect the whole context.",
      "The proposal response includes status, owners, source links, and the snapshot commit. Cite the canonical page and identify the snapshot when freshness matters. A correct HTTP 404 with a recovery link means the requested proposal or part is absent. The XML sitemap lists public canonical pages. /llms.txt is the short discovery guide. The graph's text list and Markdown response expose citation relationships without requiring WebGL. Reading-list entries are browser-local and cannot be retrieved by sharing /list alone.",
      "The optional supporting API is documented at /openapi.json and discovered through /.well-known/api-catalog. It exposes aggregate popularity, a browser reading counter, and an optional summary endpoint that is currently disabled. Reference reading does not require these endpoints. Send X-API-Version: 1, or omit the header to use version 1. Unsupported versions return a structured 400 response. Incompatible changes require a new version; if retirement is scheduled, responses will publish Deprecation and Sunset headers. No retirement is currently scheduled. API errors use application/problem+json with a stable code and recovery guidance. There is no application-level request quota; the reading counter suppresses repeats rather than returning a rate-limit error. Cloudflare infrastructure protections can still reject requests.",
    ],
  },
};

export const getInfoPage = (id: string) => Object.hasOwn(INFO_PAGES, id) ? INFO_PAGES[id] : undefined;

export const infoMarkdown = (id: string): string => {
  const page = getInfoPage(id)!;
  return `# ${page.title}\n\n${page.paragraphs.join("\n\n")}\n\n[Repository and issue tracker](${REPOSITORY}/issues)\n\n[Browse proposals](/zips)`;
};
