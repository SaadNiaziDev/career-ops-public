"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { MaterialSymbol } from "@/components/material-symbol";
import { PageShell } from "@/components/dossier/page-shell";
import { DossierPageHeader } from "@/components/dossier/dossier-page-header";
import { Md3Input, Md3Textarea } from "@/components/ui/md3-input";
import { Md3Chip } from "@/components/ui/md3-chip";
import { Md3Empty } from "@/components/ui/md3-empty";
import { useToast } from "@/components/providers/toast-provider";
import type { BrainState } from "@/lib/brain";
import { STATUS_OPTIONS, sharpness, type BrainStatus, type Proof, type SectionId } from "@/lib/brain-shared";
import { ProfileForm } from "@/components/brain/profile-form";
import { BrainSection, FieldLabel, Meter, brainPost, profilePost } from "./brain-ui";
import { ProofSection } from "./proof-section";
import { WriteSection } from "./write-section";

function sharpWord(p: number) {
  if (p >= 90) return "Razor sharp";
  if (p >= 70) return "Sharp";
  if (p >= 40) return "Getting there";
  return "Just started";
}

function scrollToSection(id: SectionId) {
  const el = document.getElementById(id);
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "start" });
  window.setTimeout(() => el.querySelector<HTMLElement>("input, textarea, button")?.focus({ preventScroll: true }), 400);
}

function SharpnessCard({ percent, hints }: { percent: number; hints: ReturnType<typeof sharpness>["hints"] }) {
  return (
    <section
      aria-label="How sharp your outreach is"
      className="mb-5 overflow-hidden rounded-[var(--md-sys-shape-corner-extra-large)] border border-[var(--md-sys-color-outline-variant)] bg-[var(--md-sys-color-surface-container)] p-4 sm:p-6"
    >
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <div>
          <p className="md-label-large text-[var(--md-sys-color-on-surface-variant)]">{sharpWord(percent)}</p>
          <p className="flex items-baseline gap-2">
            <span className="text-5xl font-semibold tabular-nums tracking-tight text-[var(--md-sys-color-on-surface)]">{percent}%</span>
            <span className="md-title-medium text-[var(--md-sys-color-on-surface-variant)]">sharp</span>
          </p>
        </div>
        <p className="max-w-sm text-sm text-[var(--md-sys-color-on-surface-variant)]">
          {percent >= 100 ? "Every email has everything it needs. Keep it fresh as you ship new work." : "The more it knows, the less your emails sound like everyone else's."}
        </p>
      </div>
      <Meter value={percent} className="mt-4 h-3" label="Sharpness" />
      {hints.length > 0 ? (
        <ul className="mt-4 flex flex-wrap gap-2" aria-label="Ways to sharpen">
          {hints.slice(0, 6).map((h) => (
            <li key={h.id}>
              <button
                type="button"
                onClick={() => scrollToSection(h.section)}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-[var(--md-sys-color-outline-variant)] bg-[var(--md-sys-color-surface-container-low)] px-3 text-left text-sm transition-colors hover:border-[var(--md-sys-color-primary)] hover:bg-[var(--md-sys-color-surface-container-high)]"
              >
                <span>{h.label}</span>
                <span className="font-semibold tabular-nums text-[var(--md-sys-color-primary)]">+{h.points}%</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

/** Text input that saves on blur when the value changed. */
function AutosaveInput({
  value,
  onSave,
  ...props
}: Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "onBlur"> & { value: string; icon?: string; onSave: (v: string) => Promise<boolean> }) {
  const [draft, setDraft] = useState(value);
  const saved = useRef(value);
  useEffect(() => {
    setDraft(value);
    saved.current = value;
  }, [value]);
  return (
    <Md3Input
      {...props}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
      onBlur={async () => {
        const v = draft.trim();
        if (v === saved.current) return;
        if (!(await onSave(v))) setDraft(saved.current);
      }}
    />
  );
}

export function BrainView({ initial, loadError }: { initial: BrainState | null; loadError: string }) {
  const { toast } = useToast();
  const [state, setState] = useState<BrainState | null>(initial);
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const notesSaved = useRef(initial?.notes ?? "");

  const onState = useCallback((next: Partial<BrainState> | BrainState) => setState((s) => (s ? { ...s, ...next } : (next as BrainState))), []);

  const score = useMemo(
    () =>
      state
        ? sharpness({
            proofs: state.proofs,
            githubHandle: state.githubHandle,
            status: state.status,
            x: state.x,
            site: state.site,
            calendarLink: state.calendarLink,
            tone: state.tone,
            neverSay: state.neverSay,
            sampleCount: state.samples.length,
            cvWords: state.cv.words,
            notes: state.notes,
          })
        : null,
    [state],
  );

  const save = useCallback(
    async (patch: Record<string, unknown>, message = "Saved."): Promise<boolean> => {
      const r = await brainPost({ action: "save", patch });
      if (!r.ok) {
        toast({ message: r.error, tone: "error" });
        return false;
      }
      setState(r.state);
      toast({ message, tone: "neutral" });
      return true;
    },
    [toast],
  );

  if (!state || !score) {
    return (
      <PageShell>
        <DossierPageHeader title="Brain" description="Teach outreach who you are." />
        <Md3Empty icon="error" description={loadError || "Couldn't load your profile."}>
          <Link href="/config" className="mt-3 text-sm text-[var(--md-sys-color-primary)] hover:underline">Open Settings</Link>
        </Md3Empty>
      </PageShell>
    );
  }

  const findPercent = score.sections.find;

  async function toggleStatus(value: BrainStatus) {
    const next = state!.status.includes(value) ? state!.status.filter((s) => s !== value) : [...state!.status, value];
    await save({ status: next }, next.includes(value) ? `Emails can mention you're ${STATUS_OPTIONS.find((o) => o.value === value)?.label.toLowerCase()}.` : "Updated.");
  }

  async function saveCalendar(v: string): Promise<boolean> {
    const url = v && !/^https?:\/\//i.test(v) ? `https://${v}` : v;
    const err = await profilePost({ calendarLink: url });
    if (err) {
      toast({ message: err, tone: "error" });
      return false;
    }
    onState({ calendarLink: url });
    toast({ message: url ? "Calendar link saved." : "Calendar link removed.", tone: "neutral" });
    return true;
  }

  return (
    <PageShell>
      <DossierPageHeader
        title="Brain"
        description="Everything the AI knows about you. Evaluations, CVs, cover letters and emails all read from here."
      />

      {!state.profileExists ? (
        <p className="mb-4 rounded-2xl bg-[var(--md-sys-color-tertiary-container)] p-3 text-sm text-[var(--md-sys-color-on-tertiary-container)]">
          No config/profile.yml yet. Your first save here creates it from the example profile.
        </p>
      ) : null}

      <div className="mb-5"><ProfileForm /></div>

      <SharpnessCard percent={score.percent} hints={score.hints} />

      <div className="space-y-5">
        <ProofSection
          proofs={state.proofs}
          githubHandle={state.githubHandle}
          percent={score.sections.proof}
          onSave={(proofs: Proof[], message?: string) => save({ proofs }, message)}
        />

        <BrainSection id="find" icon="person_pin_circle" title="Where to find you" description="What you're up to, and where people can see more." percent={findPercent}>
          <div className="space-y-5">
            <div>
              <FieldLabel hint="Pick any that are true. Emails can mention it in passing.">Right now you're</FieldLabel>
              <div className="flex flex-wrap gap-2" role="group" aria-label="Status">
                {STATUS_OPTIONS.map((o) => {
                  const on = state.status.includes(o.value);
                  return (
                    <Md3Chip key={o.value} active={on} aria-pressed={on} onClick={() => void toggleStatus(o.value)} className="min-h-10 gap-1.5 rounded-full">
                      <MaterialSymbol name={on ? "check" : o.icon} size={18} />
                      {o.label}
                    </Md3Chip>
                  );
                })}
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <FieldLabel>X</FieldLabel>
                <AutosaveInput icon="alternate_email" aria-label="X handle" value={state.x} placeholder="@you" onSave={(v) => save({ x: v }, v ? "X saved." : "X removed.")} />
              </div>
              <div>
                <FieldLabel>Site</FieldLabel>
                <AutosaveInput
                  icon="language"
                  aria-label="Your site"
                  inputMode="url"
                  value={state.site}
                  placeholder="https://you.dev"
                  onSave={(v) => save({ site: v && !/^https?:\/\//i.test(v) ? `https://${v}` : v }, v ? "Site saved." : "Site removed.")}
                />
              </div>
            </div>
            <div>
              <FieldLabel hint={'Lets an email end with "can I grab 15 minutes this week? here\'s my calendar: …"'}>Calendar link</FieldLabel>
              <AutosaveInput icon="calendar_month" aria-label="Calendar link" inputMode="url" value={state.calendarLink} placeholder="https://cal.com/you/15min" onSave={saveCalendar} />
            </div>
          </div>
        </BrainSection>

        <WriteSection state={state} percent={score.sections.write} onState={onState} />

        <BrainSection id="cv" icon="badge" title="CV" description="Outreach reads your whole CV for facts. Edit it on the CV page." percent={score.sections.cv}>
          {state.cv.exists ? (
            <>
              <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl bg-[var(--md-sys-color-surface-container)] px-3 py-2.5 text-sm">
                <MaterialSymbol name="description" size={18} className="text-[var(--md-sys-color-on-surface-variant)]" />
                <span className="font-medium">cv.md</span>
                <span className="text-[var(--md-sys-color-on-surface-variant)]">{state.cv.words.toLocaleString()} words read</span>
                <Link href="/brain/cv" className="ml-auto inline-flex min-h-10 items-center gap-1 text-[var(--md-sys-color-primary)] hover:underline">
                  <MaterialSymbol name="edit" size={16} /> Edit CV
                </Link>
              </div>
              {state.cv.roles.length > 0 ? (
                <ul className="divide-y divide-[var(--md-sys-color-outline-variant)] rounded-2xl border border-[var(--md-sys-color-outline-variant)]">
                  {state.cv.roles.map((r, i) => (
                    <li key={`${r.title}-${r.company}-${i}`} className="flex items-center gap-3 px-3 py-2.5">
                      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[var(--md-sys-color-surface-container-highest)] text-sm font-semibold text-[var(--md-sys-color-on-surface-variant)]">
                        {(r.company || r.title).trim()[0]?.toUpperCase() ?? "?"}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{r.title}</p>
                        <p className="truncate text-sm text-[var(--md-sys-color-on-surface-variant)]">{[r.company, r.dates].filter(Boolean).join(" · ")}</p>
                      </div>
                      <Link href="/brain/cv" aria-label={`Edit ${r.title} in your CV`} title="Edit in CV" className="grid size-10 shrink-0 place-items-center rounded-full text-[var(--md-sys-color-on-surface-variant)] hover:bg-[var(--md-sys-color-surface-container-highest)]">
                        <MaterialSymbol name="edit" size={18} />
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-[var(--md-sys-color-on-surface-variant)]">No roles found under an Experience heading. Outreach still reads the whole file.</p>
              )}
            </>
          ) : (
            <Md3Empty icon="upload_file" description="No CV yet. Add one and every email gets real facts to work with.">
              <Link href="/brain/cv" className="md3-action-btn md3-action-btn--filled mt-3"><MaterialSymbol name="add" size={18} /><span className="md3-action-btn__label">Add your CV</span></Link>
            </Md3Empty>
          )}
        </BrainSection>

        <BrainSection
          id="notes"
          icon="sticky_note_2"
          title="Anything else"
          description="Things outreach should bring up, or never bring up. Where this and your CV disagree, this wins."
          percent={score.sections.notes}
        >
          <Md3Textarea
            aria-label="Anything else"
            rows={6}
            maxLength={8000}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={async () => {
              if (notes.trim() === notesSaved.current) return;
              if (await save({ notes }, notes.trim() ? "Notes saved." : "Notes cleared.")) notesSaved.current = notes.trim();
            }}
            placeholder={"Mention I'm free to start in December.\nNever bring up the crypto projects.\nI prefer product teams over agencies."}
          />
          <p className="mt-2 text-xs text-[var(--md-sys-color-on-surface-variant)]">Saves when you click away. Outreach reads it before every email.</p>
        </BrainSection>

        <p className="flex items-start gap-2 px-1 pb-4 text-xs text-[var(--md-sys-color-on-surface-variant)]">
          <MaterialSymbol name="lock" size={16} className="mt-px shrink-0" />
          Everything stays on this machine: the <code>outreach:</code> block in config/profile.yml, writing-samples/ and voice-dna.md.
        </p>
      </div>
    </PageShell>
  );
}
