/** A build without pandoc still works, but RST ZIPs lose fidelity; say so where it is noticed. */
export function degradedSummary(zips: Array<{ bodyFormat?: string }>): string | null {
  const count = zips.filter((zip) => zip.bodyFormat === "rst-source").length;
  if (count === 0) return null;
  return (
    `warning: ${count} RST ZIPs use the fallback renderer because pandoc was not found. ` +
    "install pandoc (brew install pandoc, apt-get install pandoc) and rerun `pnpm index` " +
    "before building for production."
  );
}
