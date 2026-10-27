import { readFileSync, writeFileSync } from "node:fs";
import { paginateReader, partHref } from "../lib/agentDocuments";
import { prepareReader } from "../lib/prepareReader";
import { zipHref } from "../lib/zipHref";
import type { ZipIndexFile } from "../lib/types";

const index = JSON.parse(readFileSync(new URL("../data/zip-index.json", import.meta.url), "utf8")) as ZipIndexFile;
const paths: string[] = [];
for (const zip of index.zips) {
  const href = zipHref(zip);
  const parts = paginateReader(await prepareReader(zip), href);
  for (let part = 2; part <= parts.length; part++) paths.push(partHref(href, part));
}
writeFileSync(new URL("../data/sitemap-parts.json", import.meta.url), JSON.stringify(paths) + "\n");
