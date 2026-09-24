import { test } from "node:test";
import assert from "node:assert/strict";
import { STATUS_LEGEND, statusColor } from "./statusColor.ts";

function channel(value: number): number {
  const c = value / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function rgb(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function luminance(hex: string): number {
  const [r, g, b] = rgb(hex).map(channel);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

function lab(hex: string): [number, number, number] {
  const [r, g, b] = rgb(hex).map(channel);
  const x = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047;
  const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883;
  const f = (t: number) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
}

function deltaE(a: string, b: string): number {
  const [l1, a1, b1] = lab(a);
  const [l2, a2, b2] = lab(b);
  return Math.hypot(l1 - l2, a1 - a2, b1 - b2);
}

test("statusColor is stable and labeled statuses differ", () => {
  assert.notEqual(statusColor("Draft"), statusColor("Final"));
  assert.equal(statusColor("NotAStatus"), "#a3a091");
});

test("every pair of legend statuses is visually distinct (CIE76 dE >= 25)", () => {
  for (let i = 0; i < STATUS_LEGEND.length; i += 1) {
    for (let j = i + 1; j < STATUS_LEGEND.length; j += 1) {
      const a = STATUS_LEGEND[i];
      const b = STATUS_LEGEND[j];
      const d = deltaE(statusColor(a), statusColor(b));
      assert.ok(d >= 25, `${a} vs ${b}: dE ${d.toFixed(1)} < 25`);
    }
  }
});

test("every legend status reads on the graph canvas (contrast >= 3:1)", () => {
  for (const label of STATUS_LEGEND) {
    const ratio = contrast(statusColor(label), "#141613");
    assert.ok(ratio >= 3, `${label}: contrast ${ratio.toFixed(2)} < 3`);
  }
});
