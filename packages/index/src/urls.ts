export function padZip(n: number): string {
  return String(n).padStart(4, "0");
}

export function officialUrl(number: number | null, slug: string): string {
  if (number === null) return `https://zips.z.cash/${slug}`;
  return `https://zips.z.cash/zip-${padZip(number)}`;
}

export function githubBlobUrl(sha: string, sourcePath: string): string {
  return `https://github.com/zcash/zips/blob/${sha}/${sourcePath}`;
}
