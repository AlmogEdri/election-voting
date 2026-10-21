/** Black or white text, whichever reads better on the given #rrggbb background. */
export function readableText(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const channel = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const lum = 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
  return lum > 0.179 ? "#000000" : "#ffffff";
}

/** "בנימין נתניהו" → "בנ". Two letters: first of the first and last words. */
export function initials(name: string) {
  const words = name.replace(/["'׳״]/g, "").split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return [...words[0]].slice(0, 2).join("");
  return [...words[0]][0] + [...words[words.length - 1]][0];
}

export function formatSeats(n: number) {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}
