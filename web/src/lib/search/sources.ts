// Free job feeds (no AI, no login): company ATS boards and remote job boards.
// Each source returns plain hits; filtering and saving happen in scan.ts.

export type Hit = {
  url: string;
  title: string;
  company: string;
  location: string;
  /** epoch ms when the feed gives a date */
  postedAt?: number;
  description?: string;
};

export type Ats = "greenhouse" | "lever" | "ashby" | "workable" | "breezy" | "smartrecruiters";
export const ATS_LABELS: Record<Ats, string> = {
  greenhouse: "Greenhouse", lever: "Lever", ashby: "Ashby", workable: "Workable", breezy: "Breezy", smartrecruiters: "SmartRecruiters",
};
export type Board = "remoteok" | "weworkremotely" | "hackernews";
export const BOARD_LABELS: Record<Board, string> = { remoteok: "RemoteOK", weworkremotely: "We Work Remotely", hackernews: "HN Who's Hiring" };

const UA = "career-ops (local job search)";

async function get(url: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(url, { ...init, headers: { "User-Agent": UA, Accept: "application/json, text/plain, */*", ...init?.headers }, signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res;
}
const json = async <T>(url: string, init?: RequestInit) => (await get(url, init)).json() as Promise<T>;
const ms = (v: unknown) => {
  const t = typeof v === "number" ? v : Date.parse(String(v ?? ""));
  return Number.isFinite(t) && t > 0 ? t : undefined;
};
const decode = (s: string) => s
  .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
  .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
  .replace(/&nbsp;/g, " ").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
const strip = (html: string) => decode(html.replace(/<[^>]+>/g, " ")).replace(/[ \t]+/g, " ").replace(/\s*\n\s*/g, "\n").trim();

/** Which ATS (and board slug) a company's careers URL points at, if supported. */
export function detectAts(rawUrl: string): { ats: Ats; slug: string } | null {
  let u: URL;
  try { u = new URL(rawUrl); } catch { return null; }
  const host = u.hostname.toLowerCase();
  const first = u.pathname.split("/").filter(Boolean)[0] ?? "";
  if (/(^|\.)greenhouse\.io$/.test(host)) {
    const slug = u.searchParams.get("for") || first;
    return slug && slug !== "embed" ? { ats: "greenhouse", slug } : null;
  }
  if (/^jobs\.(eu\.)?lever\.co$/.test(host) && first) return { ats: "lever", slug: first };
  if (host === "jobs.ashbyhq.com" && first) return { ats: "ashby", slug: first };
  if (host === "apply.workable.com" && first && first !== "j") return { ats: "workable", slug: first };
  if (/\.breezy\.hr$/.test(host)) return { ats: "breezy", slug: host.replace(/\.breezy\.hr$/, "") };
  if ((host === "careers.smartrecruiters.com" || host === "jobs.smartrecruiters.com") && first) return { ats: "smartrecruiters", slug: first };
  return null;
}

export async function fetchAts(ats: Ats, slug: string, company: string): Promise<Hit[]> {
  const s = encodeURIComponent(slug);
  switch (ats) {
    case "greenhouse": {
      const d = await json<{ jobs?: { absolute_url?: string; title?: string; location?: { name?: string }; updated_at?: string; first_published?: string }[] }>(`https://boards-api.greenhouse.io/v1/boards/${s}/jobs`);
      return (d.jobs ?? []).filter((j) => j.absolute_url).map((j) => ({ url: j.absolute_url!, title: j.title ?? "", company, location: j.location?.name ?? "", postedAt: ms(j.first_published ?? j.updated_at) }));
    }
    case "lever": {
      const d = await json<{ hostedUrl?: string; text?: string; categories?: { location?: string }; createdAt?: number; descriptionPlain?: string }[]>(`https://api.lever.co/v0/postings/${s}?mode=json`);
      return d.filter((j) => j.hostedUrl).map((j) => ({ url: j.hostedUrl!, title: j.text ?? "", company, location: j.categories?.location ?? "", postedAt: ms(j.createdAt), description: j.descriptionPlain }));
    }
    case "ashby": {
      const d = await json<{ jobs?: { jobUrl?: string; title?: string; location?: string; isRemote?: boolean; secondaryLocations?: { location?: string }[]; publishedAt?: string; descriptionPlain?: string }[] }>(`https://api.ashbyhq.com/posting-api/job-board/${s}`);
      return (d.jobs ?? []).filter((j) => j.jobUrl).map((j) => {
        const locs = [j.location, ...(j.secondaryLocations ?? []).map((l) => l.location)].filter(Boolean);
        if (j.isRemote && !locs.some((l) => /remote/i.test(l!))) locs.push("Remote");
        return { url: j.jobUrl!, title: j.title ?? "", company, location: locs.join(" · "), postedAt: ms(j.publishedAt), description: j.descriptionPlain };
      });
    }
    case "workable": {
      const hits: Hit[] = [];
      let token: string | undefined;
      for (let page = 0; page < 5; page++) {
        const d = await json<{ results?: { shortcode?: string; title?: string; location?: { city?: string; country?: string }; locations?: { city?: string; country?: string }[]; remote?: boolean; published?: string; state?: string }[]; nextPage?: string }>(
          `https://apply.workable.com/api/v3/accounts/${s}/jobs`,
          { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query: "", location: [], department: [], worktype: [], remote: [], ...(token ? { token } : {}) }) },
        );
        for (const r of d.results ?? []) {
          if (!r.shortcode || !r.title) continue;
          const locs = (r.locations?.length ? r.locations : r.location ? [r.location] : []).map((l) => [l.city, l.country].filter(Boolean).join(", "));
          if (r.remote) locs.push("Remote");
          hits.push({ url: `https://apply.workable.com/${slug}/j/${r.shortcode}/`, title: r.title, company, location: locs.join(" · "), postedAt: ms(r.published) });
        }
        token = d.nextPage;
        if (!token) break;
      }
      return hits;
    }
    case "breezy": {
      const d = await json<{ url?: string; name?: string; published_date?: string; location?: { name?: string; is_remote?: boolean; country?: { name?: string } } }[]>(`https://${s}.breezy.hr/json`);
      return d.filter((j) => j.url && j.name).map((j) => {
        const base = j.location?.name || j.location?.country?.name || "";
        return { url: j.url!, title: j.name!, company, location: j.location?.is_remote && !/remote/i.test(base) ? [base, "Remote"].filter(Boolean).join(" · ") : base, postedAt: ms(j.published_date) };
      });
    }
    case "smartrecruiters": {
      const d = await json<{ content?: { id?: string; name?: string; releasedDate?: string; location?: { fullLocation?: string; city?: string; country?: string; remote?: boolean } }[] }>(`https://api.smartrecruiters.com/v1/companies/${s}/postings?limit=100&status=PUBLIC`);
      return (d.content ?? []).filter((j) => j.id && j.name).map((j) => {
        const loc = j.location?.fullLocation || [j.location?.city, j.location?.country].filter(Boolean).join(", ");
        return { url: `https://jobs.smartrecruiters.com/${slug}/${j.id}`, title: j.name!, company, location: j.location?.remote ? [loc, "Remote"].filter(Boolean).join(" · ") : loc, postedAt: ms(j.releasedDate) };
      });
    }
  }
}

export async function fetchBoard(board: Board): Promise<Hit[]> {
  if (board === "remoteok") {
    const d = await json<{ url?: string; position?: string; company?: string; location?: string; epoch?: number; description?: string }[]>("https://remoteok.com/api");
    return d.filter((j) => j.position && j.url).map((j) => ({ url: j.url!, title: j.position!.trim(), company: j.company ?? "", location: j.location || "Remote", postedAt: j.epoch ? j.epoch * 1000 : undefined, description: j.description ? strip(j.description) : undefined }));
  }
  if (board === "weworkremotely") {
    const xml = await (await get("https://weworkremotely.com/remote-jobs.rss")).text();
    const tag = (item: string, name: string) => strip(item.match(new RegExp(`<${name}>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?</${name}>`))?.[1] ?? "");
    return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map((m) => {
      const raw = tag(m[1], "title");
      const i = raw.indexOf(":");
      return { url: tag(m[1], "link"), company: i > 0 ? raw.slice(0, i).trim() : "", title: i > 0 ? raw.slice(i + 1).trim() : raw, location: tag(m[1], "region") || "Remote", postedAt: ms(tag(m[1], "pubDate")) };
    }).filter((h) => h.url && h.title);
  }
  // HN "Ask HN: Who is hiring?" — newest thread, one hit per top-level comment.
  const search = await json<{ hits?: { objectID: string; title?: string }[] }>("https://hn.algolia.com/api/v1/search_by_date?tags=story,author_whoishiring&hitsPerPage=5");
  const thread = (search.hits ?? []).find((h) => /who is hiring/i.test(h.title ?? ""));
  if (!thread) return [];
  const item = await json<{ children?: { id: number; text?: string; created_at_i?: number }[] }>(`https://hn.algolia.com/api/v1/items/${thread.objectID}`);
  return (item.children ?? []).flatMap((c) => {
    if (!c.text) return [];
    const text = strip(c.text.replace(/<p>/g, "\n"));
    const first = text.split("\n")[0].slice(0, 200);
    // Candidates sometimes post "Location: … Willing to relocate: …" in the thread; those aren't jobs.
    if (!first.includes("|") || /^\s*(location|seeking|remote)\s*:/i.test(first)) return [];
    const parts = first.split("|").map((p) => p.trim());
    const link = decode(c.text.match(/href="([^"]+)"/)?.[1] ?? "");
    return [{
      url: link && /^https?:\/\//.test(link) ? link : `https://news.ycombinator.com/item?id=${c.id}`,
      company: parts[0] ?? "",
      title: parts[1]?.replace(/https?:\/\/\S+/g, "").trim().slice(0, 120) || first.slice(0, 120),
      location: parts.find((p) => /remote|onsite|hybrid|[A-Z][a-z]+,/i.test(p)) ?? "",
      postedAt: c.created_at_i ? c.created_at_i * 1000 : undefined,
      description: text.slice(0, 4000),
    }];
  });
}
