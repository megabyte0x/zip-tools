// Writes one social preview card per proposal into public/og/ at build time, so the
// Worker serves static PNGs instead of bundling an image renderer.
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { loadIndex } from "../lib/loadIndex";
import { type OgFont, zipOgImage } from "../lib/ogCard";
import { ogImagePath } from "../lib/pageMetadata";

const out = fileURLToPath(new URL("../public", import.meta.url));
await rm(`${out}/og`, { recursive: true, force: true });
await mkdir(`${out}/og`, { recursive: true });
// The image renderer reads WOFF but not WOFF2; @fontsource ships both, so builds stay offline.
const fontFile = (family: string, weight: OgFont["weight"]) =>
  readFile(fileURLToPath(new URL(`../node_modules/@fontsource/${family}/files/${family}-latin-${weight}-normal.woff`, import.meta.url)));

async function plexFonts(): Promise<OgFont[]> {
  const faces = [["IBM Plex Serif", "ibm-plex-serif", 600], ["IBM Plex Sans", "ibm-plex-sans", 400], ["IBM Plex Sans", "ibm-plex-sans", 600]] as const;
  return Promise.all(faces.map(async ([name, family, weight]) => {
    const data = await fontFile(family, weight);
    return { name, weight, style: "normal" as const, data: data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer };
  }));
}

const fonts = await plexFonts();
const { zips } = loadIndex();
for (const zip of zips) {
  const png = Buffer.from(await zipOgImage(zip, fonts).arrayBuffer());
  await writeFile(`${out}${ogImagePath(zip)}`, png);
}
console.log(`Wrote ${zips.length} Open Graph images to public/og`);
