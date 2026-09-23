const CANONICAL_ISSUE_URL = /^https:\/\/github\.com\/zcash\/zips\/issues\/([1-9]\d*)$/;

export function supportedIssueUrl(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const match = CANONICAL_ISSUE_URL.exec(value);
  if (match === null) return null;
  return Number.isSafeInteger(Number(match[1])) ? value : null;
}
