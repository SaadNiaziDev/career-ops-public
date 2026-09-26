import { parsePipeline } from "./pipeline-entry.mjs";

export type RemoveInboxResult = {
  content: string;
  removed: number;
};

/** Remove unchecked pending rows for one exact URL and retain completed history. */
export function removePendingInboxUrl(markdown: string, rawUrl: string): RemoveInboxResult {
  const url = rawUrl.trim();
  if (!url) return { content: markdown, removed: 0 };
  const parsed = parsePipeline(markdown);
  const remove = new Set(parsed.entries
    .filter((entry) => entry.url === url && !entry.done && entry.section !== "processed")
    .map((entry) => entry.lineIndex));
  const lines = parsed.lines.filter((_, index) => !remove.has(index));
  const trailing = markdown.match(/\r?\n$/)?.[0] ?? "";
  return {
    content: lines.join(markdown.includes("\r\n") ? "\r\n" : "\n") + trailing,
    removed: remove.size,
  };
}
