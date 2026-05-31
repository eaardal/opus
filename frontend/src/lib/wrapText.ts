/**
 * Greedily word-wraps `text` into lines no longer than `maxCharsPerLine`,
 * breaking at whitespace. A single word wider than the limit is hard-broken so
 * no line can ever exceed the budget. Runs of whitespace are collapsed and
 * blank input yields an empty array.
 */
export function wrapText(text: string, maxCharsPerLine: number): string[] {
  const limit = Math.max(1, maxCharsPerLine);
  const words = text.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";

  for (let word of words) {
    // A word that can't fit on a line by itself is sliced into full-width
    // chunks; the leftover continues as a normal word below.
    while (word.length > limit) {
      if (line) lines.push(line);
      lines.push(word.slice(0, limit));
      line = "";
      word = word.slice(limit);
    }

    if (!line) {
      line = word;
    } else if (line.length + 1 + word.length <= limit) {
      line += ` ${word}`;
    } else {
      lines.push(line);
      line = word;
    }
  }

  if (line) lines.push(line);
  return lines;
}
