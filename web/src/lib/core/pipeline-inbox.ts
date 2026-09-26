export type RemoveInboxResult = {
  content: string;
  removed: number;
};

/** Remove every unchecked pipeline row for one exact URL.
 * Checked Processed rows are history and must remain untouched. */
export function removePendingInboxUrl(markdown: string, rawUrl: string): RemoveInboxResult {
  const url = rawUrl.trim();
  if (!url) return { content: markdown, removed: 0 };

  const newline = markdown.includes("\r\n") ? "\r\n" : "\n";
  const hadTrailingNewline = markdown.endsWith("\n");
  const lines = markdown.split(/\r?\n/);
  if (hadTrailingNewline) lines.pop();

  let removed = 0;
  const kept = lines.filter((line) => {
    const match = line.match(/^\s*-\s*\[\s\]\s*([^|]+?)(?:\s*\||\s*$)/);
    if (!match || match[1].trim() !== url) return true;
    removed += 1;
    return false;
  });

  const content = kept.join(newline) + (hadTrailingNewline ? newline : "");
  return { content, removed };
}
