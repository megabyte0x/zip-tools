/**
 * ZIP markdown is written for pandoc + MathJax (upstream render.sh). Two habits differ
 * from remark-math + KaTeX, so the reader bridges them here.
 */

/**
 * Pandoc accepts `$$...$$` display math inside a paragraph; remark-math only accepts `$$`
 * fences on their own lines. Rewrite every display span into a fenced block, leaving code
 * fences untouched.
 */
export function fenceDisplayMath(markdown: string): string {
  const parts = markdown.split(/(^(?:```|~~~)[^\n]*\n[\s\S]*?^(?:```|~~~)[^\n]*$)/m);
  return parts
    .map((part, index) =>
      index % 2 === 1
        ? part
        : part.replace(/\$\$([\s\S]+?)\$\$/g, (_, tex: string) => `\n\n$$\n${tex.trim()}\n$$\n\n`),
    )
    .join("");
}

/** MathJax lets `_` stand inside `\text{...}`; KaTeX needs it escaped. */
export function escapeTextUnderscores(tex: string): string {
  return tex.replace(/\\text\{([^{}]*)\}/g, (_, body: string) => `\\text{${body.replace(/(?<!\\)_/g, "\\_")}}`);
}
