/**
 * Pandoc turns every `[#name]_` reference into its own endnote, so a footnote cited twice is
 * listed twice and renumbered, a reference inside another footnote is dropped, and the
 * References section stays empty. Docutils, which renders the official site, lists each
 * footnote once where it is defined, numbered in definition order, with an id derived from its
 * name. Mark the definitions in the source, then rebuild that layout from pandoc's endnotes.
 */
const REF = "\u{E001}";
const END = "\u{E002}";
const DEF = "\u{E003}";
const RUN = "\u{E004}";
const ALL = "\u{E005}";

const DEFINITION = /^\.\. \[#([^\]\s]+)\](.*)$/;
const key = (name: string) => name.toLowerCase();
// Docutils ids: lower case, other characters collapsed to hyphens, starting with a letter.
const slug = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^[^a-z]+|-+$/g, "");

export function prepareRstFootnotes(source: string): { source: string; place: (html: string) => string } {
  const lines = source.split("\n");
  const names = lines.flatMap((line) => DEFINITION.exec(line)?.[1] ?? []);
  if (names.length === 0) return { source, place: (html) => html };
  const index = new Map(names.map((name, i) => [key(name), i]));
  // Pandoc drops references inside a footnote; keep them as markers.
  const nested = (text: string) =>
    text.replace(/\[#([^\]\s]+)\]_/g, (ref, name: string) =>
      index.has(key(name)) ? `${REF}${index.get(key(name))}${END}` : ref);

  const out: string[] = [];
  const runs: number[] = [];
  let defined = 0;
  let inRun = false;
  for (let i = 0; i < lines.length; i++) {
    const def = DEFINITION.exec(lines[i]);
    if (!def) {
      if (lines[i].trim() !== "") inRun = false;
      out.push(lines[i]);
      continue;
    }
    if (!inRun) {
      out.push("", `${RUN}${runs.length}${END}`, "");
      runs.push(defined);
      inRun = true;
    }
    out.push(`.. [#${def[1]}] ${DEF}${defined++}${END}${nested(def[2])}`);
    // The body continues through indented lines, including those after blank lines.
    let end = i + 1;
    for (let next = end; ; end = ++next) {
      while (next < lines.length && lines[next].trim() === "") next++;
      if (next === lines.length || !/^[ \t]/.test(lines[next])) break;
    }
    while (i + 1 < end) out.push(nested(lines[++i]));
  }
  // Pandoc only emits notes that are referenced; cite every one in a paragraph removed later.
  out.push("", `${ALL} ${names.map((name) => `[#${name}]_`).join(" ")}`, "");

  const place = (html: string): string => {
    const endnotes = /<(aside|section)[^>]*role="doc-endnotes"[^>]*>([\s\S]*)<\/\1>\s*$/.exec(html);
    if (!endnotes) throw new Error("pandoc emitted no endnotes");
    const bodies: string[] = [];
    const noteOf = new Map<string, number>();
    for (const [, number, chunk] of endnotes[2].matchAll(/<li id="fn(\d+)">([\s\S]*?)<\/li>\s*(?=<li id="fn\d+">|<\/ol>\s*$)/g)) {
      const def = new RegExp(`${DEF}(\\d+)${END}\\s?`).exec(chunk);
      if (!def) throw new Error(`pandoc note ${number} is not a marked footnote`);
      const i = Number(def[1]);
      noteOf.set(number, i);
      bodies[i] ??= chunk.replace(def[0], "").replace(/<a href="#fnref\d+" class="footnote-back"[^>]*>[\s\S]*?<\/a>/, "");
    }

    // Like docutils, suffix an id that a heading already uses.
    const taken = new Set([...html.matchAll(/ id="([^"]*)"/g)].map((m) => m[1]));
    const ids = names.map((name) => {
      let id = slug(name);
      for (let n = 1; taken.has(id); n++) id = `${slug(name)}-${n}`;
      taken.add(id);
      return id;
    });
    const anchor = (name: string) => ids[index.get(key(name))!];
    const refs: number[] = names.map(() => 0);
    const ref = (i: number) => {
      const id = `fnref-${anchor(names[i])}${refs[i]++ ? `-${refs[i]}` : ""}`;
      return `<a href="#${anchor(names[i])}" class="footnote-ref" id="${id}" data-footnote-ref=""><sup>${i + 1}</sup></a>`;
    };
    const refsIn = (text: string) =>
      text
        .replace(/<a href="#fn(\d+)" class="footnote-ref"[^>]*><sup>\d+<\/sup><\/a>/g, (_, n: string) => ref(noteOf.get(n)!))
        .replace(new RegExp(`${REF}(\\d+)${END}`, "g"), (_, i: string) => ref(Number(i)));

    const body = refsIn(html.slice(0, endnotes.index).replace(new RegExp(`<p>${ALL}[\\s\\S]*?</p>\\s*`), ""));
    const notes = bodies.map((text) => refsIn(text));
    if (notes.length !== names.length || notes.includes(undefined as never)) throw new Error("pandoc lost a footnote");

    return body.replace(new RegExp(`<p>${RUN}(\\d+)${END}</p>`, "g"), (_, k: string) => {
      const first = runs[Number(k)];
      const items = names.slice(first, runs[Number(k) + 1] ?? names.length).map((name, offset) => {
        const i = first + offset;
        const back = refs[i] ? ` <a href="#fnref-${anchor(name)}" class="footnote-back" data-footnote-backref="">↩︎</a>` : "";
        const text = /<\/p>\s*$/.test(notes[i]) ? notes[i].replace(/<\/p>(\s*)$/, `${back}</p>$1`) : notes[i] + back;
        return `<li id="${anchor(name)}">${text.trim()}</li>`;
      });
      return `<ol class="footnotes" start="${first + 1}">\n${items.join("\n")}\n</ol>`;
    });
  };

  return { source: out.join("\n"), place };
}
