import Link from "next/link";

export function SearchTabs({ current }: { current: "find" | "saved" }) {
  return <nav aria-label="Search views" className="mb-5 flex flex-wrap items-center gap-2">
    <Link href="/explore" aria-current={current === "find" ? "page" : undefined} className={`md3-action-btn ${current === "find" ? "md3-action-btn--filled" : "md3-action-btn--outlined"}`}>Find jobs</Link>
    <Link href="/explore?view=matches" aria-current={current === "saved" ? "page" : undefined} className={`md3-action-btn ${current === "saved" ? "md3-action-btn--filled" : "md3-action-btn--outlined"}`}>Saved matches</Link>
    <Link href="/add" className="md3-action-btn md3-action-btn--text sm:ml-auto">Add a job link</Link>
  </nav>;
}
