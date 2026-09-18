export function extractCitations(
  text: string,
  selfNumber: number | null,
): number[] {
  const found = new Set<number>();
  const patterns = [/zip-(\d{1,4})\b/gi, /ZIP\s+(\d{1,4})\b/g];
  for (const re of patterns) {
    for (const match of text.matchAll(re)) {
      const n = Number.parseInt(match[1], 10);
      if (selfNumber !== null && n === selfNumber) continue;
      found.add(n);
    }
  }
  return [...found].sort((a, b) => a - b);
}
