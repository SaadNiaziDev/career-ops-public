"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Md3Select } from "@/components/ui/md3-select";

type Artifact = {file: string; label: string; report: string | null; pdf: string | null; format: string; mtime: number};

export function TailoredCvLibrary() {
  const [items, setItems] = useState<Artifact[]>([]);
  const [selected, setSelected] = useState("");
  const [html, setHtml] = useState("");
  const [master, setMaster] = useState("");
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [reviewed, setReviewed] = useState(false);
  const [compare, setCompare] = useState(false);
  const [pages, setPages] = useState(0);
  const current = items.find(item => item.file === selected);

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([fetch("/api/cv/generated", {signal: controller.signal}), fetch("/api/cv?source=cv.md", {signal: controller.signal})])
      .then(async ([list, source]) => {
        if (!list.ok || !source.ok) throw new Error("Could not load CVs. Reload to retry.");
        const data = await list.json();
        setItems(data.generated);
        const report = new URLSearchParams(location.search).get("report");
        setSelected(report ? data.generated.find((item: Artifact) => item.report === String(Number(report)))?.file ?? "" : data.generated[0]?.file ?? "");
        setMaster((await source.json()).content ?? "");
        setLoaded(true);
      }).catch(e => { if (!controller.signal.aborted) setError(e.message); });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    setHtml(""); setReviewed(false); setCompare(false); setPages(0);
    if (!selected) return;
    const controller = new AbortController();
    setError("");
    fetch(`/api/cv/generated?file=${encodeURIComponent(selected)}`, {signal: controller.signal})
      .then(async response => {
        if (!response.ok) throw new Error("This export is unavailable. Open its application to regenerate it.");
        setHtml(await response.text());
      }).catch(e => { if (!controller.signal.aborted) setError(e.message); });
    return () => controller.abort();
  }, [selected]);

  return <section className="space-y-4 p-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="text-xl font-medium">Tailored CVs</h2><p className="text-sm">Create a tailored CV from an application’s report. Your master CV remains the evidence library.</p></div>
      <Link href="/pipeline" className="md3-btn-filled">Choose an application</Link>
    </div>
    {error && <p role="alert" className="md3-alert md3-alert--error">{error}</p>}
    {!loaded && !error && <p>Loading CVs…</p>}
    {loaded && !items.length && <p>No tailored CVs yet. Open an application and choose “Generate tailored CV”. Failed runs can be retried there.</p>}
    {loaded && items.length > 0 && !selected && <p>No tailored CV is linked to this application yet. Generate it from the application, or select another export below.</p>}
    {!!items.length && <Md3Select aria-label="Tailored CV" value={selected} onChange={setSelected} options={[{value: "", label: "Select a tailored CV"}, ...items.map(item => ({value: item.file, label: `${item.label} · ${new Date(item.mtime).toLocaleDateString()}`}))]} />}
    {current && <>
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <strong>{current.label}</strong><code>output/{current.file}</code>
        {current.report ? <Link href={`/pipeline/${current.report}`} className="underline">Application #{current.report}</Link> : <span>Legacy export · application not recorded</span>}
        {pages > 0 && <span>{pages === 1 ? "Fits one page" : `${pages} pages — review length for this role`}</span>}
      </div>
      <p className="text-sm">This saved render has its own layout. Regenerate from the application to change its content or style.</p>
      <button className="md3-btn-outlined" onClick={() => setCompare(value => !value)}>{compare ? "Hide source comparison" : "Compare with master"}</button>
      {compare && <p className="text-sm">Compare the current master with this saved tailored document. The original source snapshot was not recorded; this is not a historical change log.</p>}
      <div className={`grid gap-4 ${compare ? "lg:grid-cols-2" : ""}`}>
        {compare && <div><h3 className="font-medium">Master · cv.md</h3><pre className="max-h-[700px] overflow-auto whitespace-pre-wrap rounded border p-4 text-sm">{master}</pre></div>}
        {html && <div><h3 className="font-medium">Tailored · {current.label}</h3><iframe title="Selected tailored CV" srcDoc={html} sandbox="allow-same-origin" className="h-[700px] w-full rounded border bg-white" onLoad={event => {
          const doc = event.currentTarget.contentDocument;
          if (doc) setPages(Math.max(1, Math.ceil(Math.max(doc.body.scrollHeight, doc.documentElement.scrollHeight) / (current.format === "letter" ? 1056 : 1123))));
        }} /></div>}
      </div>
      {compare && html && <label className="flex items-center gap-2"><input type="checkbox" checked={reviewed} onChange={e => setReviewed(e.target.checked)} />I reviewed this tailored CV against my master evidence.</label>}
      {current.pdf ? reviewed && html ? <a className="md3-btn-filled" href={`/api/cv/generated?file=${encodeURIComponent(current.pdf)}`}>Download selected PDF</a> : <p className="text-sm">Compare with master and confirm your review to download this PDF.</p> : <p className="text-sm">No PDF is linked to this render. Regenerate it from the application.</p>}
    </>}
  </section>;
}
