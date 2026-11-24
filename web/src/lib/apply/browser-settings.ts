import { getKv } from "@/lib/db";

export function applicationBrowserUrl(): string {
  return process.env.CAREER_OPS_CHROME_CDP_URL?.trim() || getKv("apply.browserCdpUrl") || "";
}

