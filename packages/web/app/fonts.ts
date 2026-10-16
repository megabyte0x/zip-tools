import localFont from "next/font/local";

// IBM Plex is self-hosted from @fontsource so builds stay offline. A CSS @import of Google Fonts
// was silently dropped once bundled after other rules, leaving every visitor on fallback fonts.
// Only the weights and styles the stylesheets use. Not preloaded: in Lighthouse runs, preloading
// these files delayed first paint more than swapping from the metric-matched fallback.
// next/font requires literal options, so the paths are spelled out.

export const plexSans = localFont({
  src: [
    { path: "../node_modules/@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "../node_modules/@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-600-normal.woff2", weight: "600", style: "normal" },
  ],
  variable: "--font-plex-sans",
  display: "swap",
  preload: false,
  fallback: ["ui-sans-serif", "system-ui", "sans-serif"],
});

export const plexSerif = localFont({
  src: [
    { path: "../node_modules/@fontsource/ibm-plex-serif/files/ibm-plex-serif-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "../node_modules/@fontsource/ibm-plex-serif/files/ibm-plex-serif-latin-400-italic.woff2", weight: "400", style: "italic" },
    { path: "../node_modules/@fontsource/ibm-plex-serif/files/ibm-plex-serif-latin-600-normal.woff2", weight: "600", style: "normal" },
  ],
  variable: "--font-plex-serif",
  display: "swap",
  preload: false,
  fallback: ["Iowan Old Style", "Palatino", "serif"],
  adjustFontFallback: "Times New Roman",
});

export const plexMono = localFont({
  src: [
    { path: "../node_modules/@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "../node_modules/@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-500-normal.woff2", weight: "500", style: "normal" },
  ],
  variable: "--font-plex-mono",
  display: "swap",
  preload: false,
  fallback: ["ui-monospace", "monospace"],
  adjustFontFallback: false,
});
