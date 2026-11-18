"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { MaterialSymbol } from "@/components/material-symbol";
import { PageShell } from "@/components/dossier/page-shell";
import { DossierPageHeader } from "@/components/dossier/dossier-page-header";
import { Md3Empty } from "@/components/ui/md3-empty";
import { Md3Input, Md3Textarea } from "@/components/ui/md3-input";
import { Md3Segmented } from "@/components/ui/md3-segmented";
import { Md3ActionButton } from "@/components/ui/md3-action-button";
import { Md3Collapse } from "@/components/ui/md3-collapse";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/providers/toast-provider";
import { useJobs } from "@/components/jobs/job-store";
import { cn } from "@/lib/cn";
import {
  followupSubject,
  gmailComposeUrl,
  isFollowupDue,
  mailtoUrl,
  nextFollowup,
  type OutreachFollowup,
  type OutreachPerson,
  type OutreachRecord,
  type SentVia,
} from "@/lib/outreach-shared";

export type OutreachPick = { n: string; company: string; role: string; score: number; status: string; url?: string; date: string };
type Tab = "ready" | "due" | "sent" | "picks";
type Tone = "polite" | "confident" | "spicy";

const TONES: { value: Tone; label: string }[] = [
  { value: "polite", label: "Polite" },
  { value: "confident", label: "Confident" },
  { value: "spicy", label: "Spicy" },
];

async function patchItem(body: Record<string, unknown>): Promise<OutreachRecord | null> {
  const res = await fetch("/api/outreach", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) return null;
  return ((await res.json()) as { item: OutreachRecord }).item;
}

function shortDate(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00` : iso);
  const today = new Date();
  const diff = Math.round((new Date(d.toDateString()).getTime() - new Date(today.toDateString()).getTime()) / 86_400_000);
  if (diff === 0) return "today";
  if (diff === -1) return "yesterday";
  if (diff === 1) return "tomorrow";
  if (diff > 1 && diff < 7) return d.toLocaleDateString(undefined, { weekday: "long" });
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function EmailBadge({ p }: { p: OutreachPerson }) {
  if (p.emailConfidence === "found") return <Badge tone="good">Email found</Badge>;
  if (p.emailConfidence === "pattern") return <Badge tone="warn">Guessed from company pattern</Badge>;
  return <Badge tone="muted">No email, use LinkedIn or X</Badge>;
}

function Initial({ name }: { name: string }) {
  return (
    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[var(--md-sys-color-primary-container)] text-sm font-semibold text-[var(--md-sys-color-on-primary-container)]">
      {(name.trim()[0] || "?").toUpperCase()}
    </span>
  );
}

function ListRow({ item, active, onClick }: { item: OutreachRecord; active: boolean; onClick: () => void }) {
  const next = nextFollowup(item);
  const due = isFollowupDue(item);
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-start gap-3 border-b border-[var(--md-sys-color-outline-variant)] px-4 py-3 text-left last:border-b-0 hover:bg-[var(--md-sys-color-surface-container-high)]",
        active && "bg-[var(--md-sys-color-secondary-container)] hover:bg-[var(--md-sys-color-secondary-container)]",
      )}
    >
      <Initial name={item.company} />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{item.role || item.company}</span>
        <span className="block truncate text-sm text-[var(--md-sys-color-on-surface-variant)]">
          {item.company} · {item.contact.name}
        </span>
        <span className="mt-1 block text-xs text-[var(--md-sys-color-on-surface-variant)]">
          {item.status === "ready" && "Ready to send"}
          {item.status === "sent" && (next?.dueAt ? <span className={due ? "font-medium text-[var(--md-sys-color-error)]" : ""}>{due ? "Follow-up due" : "Follow-up"} {shortDate(next.dueAt)}</span> : `Sent ${shortDate(item.sentAt)}`)}
          {item.status === "replied" && "Replied"}
          {item.status === "dismissed" && "Dismissed"}
        </span>
      </span>
    </button>
  );
}

function VoiceSettings() {
  const { toast } = useToast();
  const [tone, setTone] = useState<Tone>("confident");
  const [neverSay, setNeverSay] = useState("");
  const [calendar, setCalendar] = useState("");
  const [proof, setProof] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    fetch("/api/profile")
      .then((r) => r.json())
      .then((d: { profile?: { outreachTone?: string; outreachNeverSay?: string[]; calendarLink?: string; leadProof?: string } }) => {
        const p = d.profile ?? {};
        if (p.outreachTone && ["polite", "confident", "spicy"].includes(p.outreachTone)) setTone(p.outreachTone as Tone);
        setNeverSay((p.outreachNeverSay ?? []).join(", "));
        setCalendar(p.calendarLink ?? "");
        setProof(p.leadProof ?? "");
      })
      .catch(() => {});
  }, []);
  async function save() {
    setSaving(true);
    const res = await fetch("/api/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        outreachTone: tone,
        outreachNeverSay: neverSay.split(",").map((s) => s.trim()).filter(Boolean),
        calendarLink: calendar.trim(),
        leadProof: proof.trim(),
      }),
    }).catch(() => null);
    setSaving(false);
    const data = res ? ((await res.json().catch(() => ({}))) as { error?: string }) : { error: "Could not reach the server." };
    toast(res?.ok ? { message: "Voice saved. New emails will use it.", tone: "neutral" } : { message: data.error || "Could not save.", tone: "error" });
  }
  return (
    <Md3Collapse title={<span className="inline-flex items-center gap-2"><MaterialSymbol name="record_voice_over" size={18} /> Your voice</span>}>
      <div className="grid gap-4 p-2 md:grid-cols-2">
        <div className="space-y-2">
          <p className="text-sm font-medium">Default tone</p>
          <Md3Segmented aria-label="Default tone" value={tone} onChange={setTone} options={TONES} />
        </div>
        <label className="space-y-2 text-sm">
          <span className="font-medium">Words you'd never say (comma separated)</span>
          <Md3Input value={neverSay} onChange={(e) => setNeverSay(e.target.value)} placeholder="thrilled, ninja, circle back" />
        </label>
        <label className="space-y-2 text-sm">
          <span className="font-medium">Calendar link</span>
          <Md3Input value={calendar} onChange={(e) => setCalendar(e.target.value)} placeholder="https://calendly.com/you/15min" />
        </label>
        <label className="space-y-2 text-sm">
          <span className="font-medium">Proof to lead every email with</span>
          <Md3Input value={proof} onChange={(e) => setProof(e.target.value)} placeholder="https://your-best-project.com" />
        </label>
        <p className="text-xs text-[var(--md-sys-color-on-surface-variant)] md:col-span-2">
          Saved to the <code>outreach:</code> block in config/profile.yml. Emails also copy how you write from <code>writing-samples/</code> and follow every rule in <code>modes/_custom.md</code>.
        </p>
        <div className="md:col-span-2">
          <Md3ActionButton variant="filled" icon="save" loading={saving} onClick={save}>Save voice</Md3ActionButton>
        </div>
        <Link href="/brain" className="text-sm text-[var(--md-sys-color-primary)] hover:underline md:col-span-2">Fine-tune everything in Brain →</Link>
      </div>
    </Md3Collapse>
  );
}

function FollowupRow({ item, f, onChange }: { item: OutreachRecord; f: OutreachFollowup; onChange: (r: OutreachRecord) => void }) {
  const { toast } = useToast();
  const [text, setText] = useState(f.body);
  const [opened, setOpened] = useState(false);
  const [confirming, setConfirming] = useState(false);
  useEffect(() => setText(f.body), [f.body]);
  const due = !f.sentAt && f.dueAt && f.dueAt <= new Date().toISOString().slice(0, 10);
  async function send() {
    if (!item.contact.email) {
      await navigator.clipboard.writeText(text).catch(() => {});
      toast({ message: "Follow-up copied. Paste it in your LinkedIn or X thread.", tone: "neutral" });
    } else {
      window.open(gmailComposeUrl(item.contact.email, followupSubject(item.subject), text), "_blank", "noopener");
    }
    setOpened(true);
  }
  return (
    <div className="rounded-xl border border-[var(--md-sys-color-outline-variant)] p-3">
      <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
        <strong>Day {f.day}</strong>
        {f.sentAt ? <Badge tone="good">Sent {shortDate(f.sentAt)}</Badge> : f.dueAt ? <Badge tone={due ? "bad" : "muted"}>{due ? "Due" : "Due"} {shortDate(f.dueAt)}</Badge> : <Badge>After you send</Badge>}
      </div>
      <Md3Textarea
        value={text}
        disabled={!!f.sentAt}
        rows={3}
        onChange={(e) => setText(e.target.value)}
        onBlur={async () => {
          if (text === f.body) return;
          const next = await patchItem({ id: item.id, action: "edit", day: f.day, body: text });
          if (next) onChange(next);
        }}
      />
      {item.status === "sent" && !f.sentAt && (
        <div className="mt-2">
          <Md3ActionButton variant={due ? "filled" : "outlined"} icon="reply" onClick={send}>
            {item.contact.email ? "Open follow-up in Gmail" : "Copy follow-up"}
          </Md3ActionButton>
        </div>
      )}
      {opened && !f.sentAt && <div className="mt-3 space-y-2"><p className="text-xs">Send the follow-up, then confirm. Update the text above if you changed it in your mail app.</p><Md3ActionButton loading={confirming} disabled={confirming} onClick={async () => { setConfirming(true); const next = await patchItem({ id: item.id, action: "followup-sent", day: f.day, body: text, confirmed: true }); setConfirming(false); if (next) { onChange(next); setOpened(false); } else toast({ message: "Could not record the follow-up.", tone: "error" }); }}>I sent this follow-up</Md3ActionButton></div>}
    </div>
  );
}

export function OutreachDetail({ item, onChange }: { item: OutreachRecord; onChange: (r: OutreachRecord) => void }) {
  const { toast } = useToast();
  const [to, setTo] = useState(item.contact.email);
  const [subject, setSubject] = useState(item.subject);
  const [body, setBody] = useState(item.body);
  const [openedVia, setOpenedVia] = useState<SentVia | null>(null);
  const [confirming, setConfirming] = useState(false);
  useEffect(() => {
    setTo(item.contact.email);
    setSubject(item.subject);
    setBody(item.body);
  }, [item.id, item.contact.email, item.subject, item.body]);

  const persist = useCallback(async () => {
    if (subject === item.subject && body === item.body) return;
    const next = await patchItem({ id: item.id, action: "edit", subject, body });
    if (next) onChange(next);
  }, [subject, body, item, onChange]);

  async function markSent() {
    if (!openedVia || confirming) return;
    setConfirming(true);
    const next = await patchItem({ id: item.id, action: "sent", via: openedVia, confirmed: true, recipient: to, subject, body });
    setConfirming(false);
    if (!next) return toast({ message: "Could not record the sent message.", tone: "error" });
    onChange(next);
    setOpenedVia(null);
    toast({ message: "Sent message saved. Follow-ups are scheduled, and the exact text is available in Track.", tone: "neutral" });
  }

  function sendGmail() {
    if (!to) return;
    window.open(gmailComposeUrl(to, subject, body), "_blank", "noopener");
    setOpenedVia("gmail");
  }
  function sendMailApp() {
    if (!to) return;
    window.location.href = mailtoUrl(to, subject, body);
    setOpenedVia("mail-app");
  }
  async function sendSocial(via: "linkedin" | "x") {
    const url = via === "linkedin" ? item.contact.linkedin : item.contact.x;
    await navigator.clipboard.writeText(item.linkedinNote || body).catch(() => {});
    if (url) window.open(url, "_blank", "noopener");
    setOpenedVia(via);
  }
  async function act(action: "replied" | "dismiss" | "restore") {
    const next = await patchItem({ id: item.id, action });
    if (next) onChange(next);
  }
  async function useAlternate(index: number) {
    const next = await patchItem({ id: item.id, action: "use-alternate", index });
    if (next) onChange(next);
  }

  const c = item.contact;
  const locked = item.status !== "ready";
  return (
    <div className="space-y-5 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="md-title-large truncate">{item.role || item.company}</h2>
          <p className="text-sm text-[var(--md-sys-color-on-surface-variant)]">
            {item.company}
            {item.trackerNum && (
              <> · <Link className="text-[var(--md-sys-color-primary)] hover:underline" href={`/pipeline/${item.trackerNum}`}>#{item.trackerNum}</Link></>
            )}
            {item.jobUrl && (
              <> · <a className="text-[var(--md-sys-color-primary)] hover:underline" href={item.jobUrl} target="_blank" rel="noreferrer">job post</a></>
            )}
          </p>
        </div>
        {item.status === "sent" && <Badge tone="good">Sent {shortDate(item.sentAt)}{item.sentVia === "gmail" ? " from Gmail" : ""}</Badge>}
        {item.status === "replied" && <Badge tone="good">Replied</Badge>}
        {item.status === "dismissed" && <Badge>Dismissed</Badge>}
      </div>

      <div className="rounded-2xl bg-[var(--md-sys-color-surface-container)] p-4">
        <div className="flex items-start gap-3">
          <Initial name={c.name} />
          <div className="min-w-0 flex-1">
            <p className="font-medium">{c.name}</p>
            <p className="text-sm text-[var(--md-sys-color-on-surface-variant)]">{c.title}</p>
            {c.why && <p className="mt-1 text-sm">{c.why}</p>}
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
              <EmailBadge p={c} />
              {c.emailEvidence && <a className="text-[var(--md-sys-color-primary)] hover:underline" href={c.emailEvidence} target="_blank" rel="noreferrer">email evidence</a>}
              {c.sourceUrl && <a className="text-[var(--md-sys-color-primary)] hover:underline" href={c.sourceUrl} target="_blank" rel="noreferrer">source</a>}
              {c.linkedin && <a className="text-[var(--md-sys-color-primary)] hover:underline" href={c.linkedin} target="_blank" rel="noreferrer">LinkedIn</a>}
              {c.x && <a className="text-[var(--md-sys-color-primary)] hover:underline" href={c.x} target="_blank" rel="noreferrer">X</a>}
            </div>
          </div>
        </div>
        {item.alternates.length > 0 && item.status === "ready" && (
          <div className="mt-3 flex flex-wrap gap-2 border-t border-[var(--md-sys-color-outline-variant)] pt-3 text-sm">
            <span className="text-[var(--md-sys-color-on-surface-variant)]">Or write to</span>
            {item.alternates.map((a, i) => (
              <button key={`${a.name}-${i}`} type="button" onClick={() => useAlternate(i)} className="rounded-full border border-[var(--md-sys-color-outline-variant)] px-3 py-1 hover:bg-[var(--md-sys-color-surface-container-high)]" title={a.why}>
                {a.name}{a.title ? `, ${a.title}` : ""}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-3">
        <label className="block space-y-1 text-sm">
          <span className="font-medium">To</span>
          <Md3Input value={to} onChange={(e) => setTo(e.target.value)} placeholder="No email found, add one if you know it" disabled={locked} />
        </label>
        <label className="block space-y-1 text-sm">
          <span className="font-medium">Subject</span>
          <Md3Input value={subject} onChange={(e) => setSubject(e.target.value)} onBlur={persist} disabled={locked} />
        </label>
        <label className="block space-y-1 text-sm">
          <span className="font-medium">Email</span>
          <Md3Textarea value={body} rows={12} onChange={(e) => setBody(e.target.value)} onBlur={persist} disabled={locked} />
        </label>
        <p className="text-xs text-[var(--md-sys-color-on-surface-variant)]">{body.trim().split(/\s+/).filter(Boolean).length} words</p>
      </div>

      {item.status === "ready" && (
        <div className="flex flex-wrap gap-2">
          <Md3ActionButton variant="filled" icon="send" disabled={!to} onClick={sendGmail}>Open Gmail draft</Md3ActionButton>
          <Md3ActionButton icon="mail" disabled={!to} onClick={sendMailApp}>Mail app</Md3ActionButton>
          {c.linkedin && <Md3ActionButton icon="link" onClick={() => sendSocial("linkedin")}>LinkedIn</Md3ActionButton>}
          {c.x && <Md3ActionButton icon="alternate_email" onClick={() => sendSocial("x")}>X</Md3ActionButton>}
          <Md3ActionButton variant="text" icon="content_copy" onClick={async () => { await navigator.clipboard.writeText(`${subject}\n\n${body}`).catch(() => {}); toast({ message: "Copied.", tone: "neutral" }); }}>Copy</Md3ActionButton>
          <Md3ActionButton variant="text" icon="close" onClick={() => act("dismiss")}>Skip</Md3ActionButton>
        </div>
      )}
      {openedVia && item.status === "ready" && (
        <div className="space-y-2 rounded-xl border border-[var(--md-sys-color-outline-variant)] p-3">
          <p className="text-sm">Review and send in your mail app or message thread, then confirm here. If you edited the text there, update the copy above before recording it.</p>
          <div className="flex flex-wrap gap-2"><Md3ActionButton icon="check" onClick={() => void markSent()} loading={confirming} disabled={confirming}>I sent this message</Md3ActionButton><Md3ActionButton variant="text" onClick={() => setOpenedVia(null)} disabled={confirming}>Not sent yet</Md3ActionButton></div>
        </div>
      )}
      {c.emailConfidence === "pattern" && item.status === "ready" && (
        <p className="text-xs text-[var(--md-sys-color-on-surface-variant)]">This address follows the company's email format but wasn't published. If it bounces, use LinkedIn or one of the other people above.</p>
      )}

      {item.followups.length > 0 && item.status !== "dismissed" && (
        <div className="space-y-3">
          <h3 className="md-title-medium">Follow-ups</h3>
          <p className="text-xs text-[var(--md-sys-color-on-surface-variant)]">A short follow-up often gets the reply the first email didn't. They show up under "Follow-ups due" on the right day.</p>
          {item.followups.map((f) => <FollowupRow key={f.day} item={item} f={f} onChange={onChange} />)}
        </div>
      )}

      {item.status === "sent" && (
        <div className="flex flex-wrap gap-2">
          <Md3ActionButton icon="mark_email_read" onClick={() => act("replied")}>They replied, stop follow-ups</Md3ActionButton>
        </div>
      )}
      {item.status === "dismissed" && <Md3ActionButton icon="undo" onClick={() => act("restore")}>Restore</Md3ActionButton>}
    </div>
  );
}

export function OutreachView({ initialItems, picks, embedded = false }: { initialItems: OutreachRecord[]; picks: OutreachPick[]; embedded?: boolean }) {
  const { toast } = useToast();
  const { jobs, startJob } = useJobs();
  const [items, setItems] = useState(initialItems);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>(initialItems.some((i) => i.status === "ready") ? "ready" : picks.length ? "picks" : "sent");
  const [input, setInput] = useState("");
  const [tone, setTone] = useState<Tone>("confident");

  const refresh = useCallback(async () => {
    const res = await fetch("/api/outreach").catch(() => null);
    if (!res?.ok) return;
    const data = (await res.json()) as { items: OutreachRecord[] };
    setItems(data.items);
  }, []);

  useEffect(() => {
    const onDone = (e: Event) => {
      const kind = (e as CustomEvent<{ kind?: string }>).detail?.kind;
      if (kind === "outreach") void refresh().then(() => setTab("ready"));
    };
    window.addEventListener("co-job-done", onDone);
    return () => window.removeEventListener("co-job-done", onDone);
  }, [refresh]);

  const running = jobs.filter((j) => j.kind === "outreach" && (j.state === "running" || j.state === "queued" || j.status === "running"));
  // Hide a failure once that target later succeeded or is being retried.
  const failed = jobs
    .filter((j) => j.kind === "outreach" && j.status === "error" && j.state !== "cancelled")
    .filter((j) => !items.some((i) => i.trackerNum === j.input || i.jobUrl === j.input) && !running.some((r) => r.input === j.input))
    .slice(0, 3);

  const ready = items.filter((i) => i.status === "ready");
  const due = items.filter((i) => isFollowupDue(i));
  const sent = items.filter((i) => i.status === "sent" || i.status === "replied");
  const pickRows = picks.filter((p) => !items.some((i) => i.trackerNum === p.n && i.status !== "dismissed"));

  const visible = tab === "ready" ? ready : tab === "due" ? due : tab === "sent" ? sent : [];
  const selected = useMemo(() => items.find((i) => i.id === selectedId) ?? visible[0] ?? null, [items, selectedId, visible]);

  const onChange = useCallback((next: OutreachRecord) => setItems((xs) => xs.map((x) => (x.id === next.id ? next : x))), []);

  function find(target: string, label: string) {
    const value = target.trim();
    if (!value) return;
    const company = items.find((i) => i.trackerNum === value)?.company;
    const avoidContacts = items.filter((i) => company && i.company === company && i.status !== "dismissed").map((i) => i.contact.name);
    const id = startJob({ title: `Finding who's hiring: ${label}`, kind: "outreach", input: value, page: "/apply?view=email", context: { tone, avoidContacts } });
    if (!id) toast({ message: "Pick a CLI in Config first.", tone: "error" });
  }

  function findAllPicks() {
    pickRows.slice(0, 5).forEach((p) => find(p.n, `${p.company}, ${p.role}`));
    toast({ message: `Researching ${Math.min(5, pickRows.length)} roles. Drafts land in Ready to send.`, tone: "neutral" });
  }

  const Container = embedded ? "div" : PageShell;
  return (
    <Container>
      <DossierPageHeader
        title="Email drafts"
        description="Find a hiring contact, review your message, and open it in your mail app. Confirm after sending to save the exact message in Track."
      />

      <div className="mb-5 rounded-3xl border border-[var(--md-sys-color-outline-variant)] bg-[var(--md-sys-color-surface-container-low)] p-4">
        <p className="mb-3 text-sm text-[var(--md-sys-color-on-surface-variant)]">Paste a job link or a tracker number. I'll find who's hiring and write to them.</p>
        <form
          className="flex flex-col gap-3 md:flex-row md:items-center"
          onSubmit={(e) => {
            e.preventDefault();
            find(input, input.trim().slice(0, 60));
            setInput("");
          }}
        >
          <Md3Input className="flex-1" icon="link" value={input} onChange={(e) => setInput(e.target.value)} placeholder="https://jobs.company.com/... or 42" aria-label="Job link or tracker number" />
          <Md3Segmented aria-label="Tone for this email" value={tone} onChange={setTone} options={TONES} />
          <Md3ActionButton type="submit" variant="filled" icon="person_search" disabled={!input.trim()}>Find them</Md3ActionButton>
        </form>
        {running.length > 0 && (
          <ul className="mt-3 space-y-1 text-sm">
            {running.map((j) => (
              <li key={j.id} className="flex items-center gap-2 text-[var(--md-sys-color-on-surface-variant)]">
                <MaterialSymbol name="progress_activity" size={16} className="animate-spin" />
                <span className="truncate">{j.title}</span>
                <span className="truncate text-xs">· {j.steps.at(-1)?.label}</span>
              </li>
            ))}
          </ul>
        )}
        {failed.length > 0 && (
          <ul className="mt-2 space-y-1 text-xs text-[var(--md-sys-color-error)]">
            {failed.map((j) => <li key={j.id}>{j.title}: {j.error}</li>)}
          </ul>
        )}
      </div>

      <div className="mb-5"><VoiceSettings /></div>

      <Md3Segmented
        aria-label="Outreach view"
        className="mb-4"
        value={tab}
        onChange={(t) => { setTab(t); setSelectedId(null); }}
        options={[
          { value: "ready", label: `Ready to send ${ready.length}` },
          { value: "due", label: `Follow-ups due ${due.length}` },
          { value: "sent", label: `Sent ${sent.length}` },
          { value: "picks", label: `Picks ${pickRows.length}` },
        ]}
      />

      {tab === "picks" ? (
        pickRows.length === 0 ? (
          <Md3Empty icon="task_alt" description="No new picks. Picks are evaluated roles scoring 4.0 or more, at companies you haven't emailed this month." />
        ) : (
          <div className="md3-pipeline-list-panel">
            <div className="flex items-center justify-between border-b border-[var(--md-sys-color-outline-variant)] px-4 py-3">
              <p className="text-sm text-[var(--md-sys-color-on-surface-variant)]">Your best evaluated roles nobody has been emailed about yet.</p>
              <Md3ActionButton variant="filled" icon="bolt" onClick={findAllPicks}>Write the top {Math.min(5, pickRows.length)}</Md3ActionButton>
            </div>
            {pickRows.map((p) => (
              <div key={p.n} className="flex flex-wrap items-center gap-3 border-b border-[var(--md-sys-color-outline-variant)] px-4 py-3 last:border-b-0">
                <Badge tone={p.score >= 4.5 ? "good" : "warn"}>{p.score.toFixed(1)}</Badge>
                <div className="min-w-0 flex-1">
                  <Link href={`/pipeline/${p.n}`} className="block truncate font-medium hover:underline">{p.role}</Link>
                  <span className="text-sm text-[var(--md-sys-color-on-surface-variant)]">{p.company} · #{p.n} · {p.status}</span>
                </div>
                <Md3ActionButton icon="person_search" disabled={running.some((j) => j.input === p.n)} loading={running.some((j) => j.input === p.n)} onClick={() => find(p.n, `${p.company}, ${p.role}`)}>
                  Find &amp; write
                </Md3ActionButton>
              </div>
            ))}
          </div>
        )
      ) : visible.length === 0 ? (
        <Md3Empty
          icon={tab === "ready" ? "outgoing_mail" : tab === "due" ? "event_available" : "send"}
          description={tab === "ready" ? "Nothing ready to send. Paste a job above, or write to one of your picks." : tab === "due" ? "No follow-ups due today." : "Nothing sent yet."}
        >
          {tab === "ready" && pickRows.length > 0 && <Md3ActionButton className="mt-3" icon="bolt" onClick={() => setTab("picks")}>See {pickRows.length} picks</Md3ActionButton>}
        </Md3Empty>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(16rem,22rem)_minmax(0,1fr)]">
          <div className="md3-pipeline-list-panel h-fit overflow-hidden">
            {visible.map((i) => <ListRow key={i.id} item={i} active={selected?.id === i.id} onClick={() => setSelectedId(i.id)} />)}
          </div>
          <div className="md3-pipeline-list-panel min-w-0">{selected ? <OutreachDetail key={selected.id} item={selected} onChange={onChange} /> : null}</div>
        </div>
      )}
    </Container>
  );
}
