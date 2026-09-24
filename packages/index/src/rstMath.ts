/**
 * ZIP authors write inline math as `$...$` in reStructuredText, which RST itself does not
 * know. Pandoc then reads each `\` as an escape and the TeX is lost. Mirror upstream
 * zcash/zips render.sh (lines 88-94): per line, `\$` is a literal dollar and every other
 * `$...$` span becomes a `:math:` role.
 */
const LITERAL_DOLLAR = "\u{E000}";

export function protectRstMath(source: string): string {
  return source
    .split("\n")
    .map((line) =>
      line
        .replace(/\\\$/g, LITERAL_DOLLAR)
        .replace(/\$([^$]+)\$/g, (_, tex: string) => `:math:\`${tex}\``)
        .replaceAll(LITERAL_DOLLAR, "$"),
    )
    .join("\n");
}
