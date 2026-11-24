/** Setup accepts only a browser debug server on this computer. */
export function localBrowserUrl(value: unknown): string {
  if (typeof value !== "string") throw new Error("Enter a local Chrome debugging URL.");
  if (!value.trim()) return "";
  const url = new URL(value.trim());
  if (url.protocol !== "http:" || !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) || url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
    throw new Error("Use a local HTTP address such as http://127.0.0.1:9222.");
  }
  return url.origin;
}
