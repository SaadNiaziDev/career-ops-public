import { applicationBrowserUrl } from "@/lib/apply/browser-settings";
import { localBrowserUrl } from "@/lib/apply/browser-url";
import { setKv } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({ url: applicationBrowserUrl(), managed: !!process.env.CAREER_OPS_CHROME_CDP_URL?.trim() });
}

export async function PUT(req: Request) {
  try {
    if (process.env.CAREER_OPS_CHROME_CDP_URL?.trim()) throw new Error("This connection is configured by CAREER_OPS_CHROME_CDP_URL. Update that environment variable instead.");
    const body = await req.json();
    const url = localBrowserUrl(body.url);
    if (url) {
      const response = await fetch(`${url}/json/version`, { redirect: "error", signal: AbortSignal.timeout(4000), cache: "no-store" });
      if (!response.ok) throw new Error("Chrome debugging endpoint did not respond successfully.");
      const version = await response.json();
      if (typeof version.webSocketDebuggerUrl !== "string" || !version.webSocketDebuggerUrl.startsWith("ws")) throw new Error("This address is not a Chrome debugging endpoint.");
    }
    setKv("apply.browserCdpUrl", url);
    return Response.json({ url, message: url ? "Browser connection verified and saved. New application sessions will reuse this Chrome profile." : "Connection cleared. Prefill will use a separate Chrome profile." });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Could not connect to Chrome." }, { status: 400 });
  }
}
