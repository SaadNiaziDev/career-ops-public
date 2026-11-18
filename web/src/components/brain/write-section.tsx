"use client";

import { useState } from "react";
import { MaterialSymbol } from "@/components/material-symbol";
import { Md3Input, Md3Textarea } from "@/components/ui/md3-input";
import { Md3Segmented } from "@/components/ui/md3-segmented";
import { Md3ActionButton } from "@/components/ui/md3-action-button";
import { useToast } from "@/components/providers/toast-provider";
import type { BrainState } from "@/lib/brain";
import type { Tone } from "@/lib/brain-shared";
import { BrainSection, FieldLabel, brainPost, profilePost } from "./brain-ui";

const TONES: { value: Tone; label: string }[] = [
  { value: "polite", label: "Polite" },
  { value: "confident", label: "Confident" },
  { value: "spicy", label: "Spicy" },
];

const TONE_HINT: Record<Tone, string> = {
  polite: "Warm and considerate.",
  confident: "Direct, peer to peer.",
  spicy: "Bold opener, a little humour, still professional.",
};

export function WriteSection({ state, percent, onState }: { state: BrainState; percent: number; onState: (next: Partial<BrainState> | BrainState) => void }) {
  const { toast } = useToast();
  const [text, setText] = useState("");
  const [reading, setReading] = useState(false);
  const [word, setWord] = useState("");
  const words = text.trim().split(/\s+/).filter(Boolean).length;

  async function readStyle() {
    setReading(true);
    const r = await brainPost({ action: "add-sample", text });
    setReading(false);
    if (!r.ok) return toast({ message: r.error, tone: "error" });
    onState(r.state);
    setText("");
    toast({ message: "Got it. Emails will sound more like you.", tone: "neutral" });
  }

  async function removeSample(file: string) {
    const r = await brainPost({ action: "delete-sample", file });
    if (!r.ok) return toast({ message: r.error, tone: "error" });
    onState(r.state);
    toast({ message: "Sample removed.", tone: "neutral" });
  }

  async function setTone(tone: Tone) {
    const prev = state.tone;
    onState({ tone });
    const err = await profilePost({ outreachTone: tone });
    if (err) {
      onState({ tone: prev });
      toast({ message: err, tone: "error" });
    } else toast({ message: `Tone: ${tone}.`, tone: "neutral" });
  }

  async function saveNever(list: string[], message: string) {
    const prev = state.neverSay;
    onState({ neverSay: list });
    const err = await profilePost({ outreachNeverSay: list });
    if (err) {
      onState({ neverSay: prev });
      toast({ message: err, tone: "error" });
    } else toast({ message, tone: "neutral" });
  }

  function addWords() {
    const fresh = word.split(",").map((w) => w.trim()).filter(Boolean).filter((w) => !state.neverSay.some((n) => n.toLowerCase() === w.toLowerCase()));
    setWord("");
    if (fresh.length) void saveNever([...state.neverSay, ...fresh], fresh.length === 1 ? `Never saying "${fresh[0]}".` : `Added ${fresh.length} words.`);
  }

  return (
    <BrainSection id="write" icon="draw" title="How you write" description="Paste something you wrote. Emails copy how you write, never what you wrote." percent={percent}>
      <div className="space-y-5">
        <div>
          {state.style ? (
            <div className="mb-3 rounded-2xl bg-[var(--md-sys-color-surface-container)] p-3 sm:p-4">
              <p className="mb-2 flex flex-wrap items-center gap-x-2 text-sm font-medium">
                <MaterialSymbol name="auto_awesome" size={18} className="text-[var(--md-sys-color-primary)]" />
                Your style
                <span className="font-normal text-[var(--md-sys-color-on-surface-variant)]">
                  from {state.samples.length} sample{state.samples.length === 1 ? "" : "s"}, {state.style.words} words
                </span>
              </p>
              <ul className="flex flex-wrap gap-2" aria-label="Detected style">
                {state.style.chips.map((c) => (
                  <li key={c} className="rounded-full bg-[var(--md-sys-color-secondary-container)] px-3 py-1 text-sm text-[var(--md-sys-color-on-secondary-container)]">{c}</li>
                ))}
              </ul>
              {state.voiceDna === "custom" ? (
                <p className="mt-2 text-xs text-[var(--md-sys-color-on-surface-variant)]">You have your own voice-dna.md, so Brain leaves it alone. Samples still feed every email.</p>
              ) : null}
            </div>
          ) : null}
          <FieldLabel hint="An email, a LinkedIn post, a Slack message you liked. 30 words or more.">Paste something you wrote</FieldLabel>
          <Md3Textarea
            aria-label="Paste something you wrote"
            rows={5}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Hey Sam, quick one. I shipped the offline mode last week and…"
          />
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <Md3ActionButton variant="filled" icon="auto_awesome" loading={reading} disabled={reading || words < 30} onClick={readStyle}>
              Read my style
            </Md3ActionButton>
            <span className="text-xs tabular-nums text-[var(--md-sys-color-on-surface-variant)]">{words < 30 ? `${words}/30 words` : `${words} words`}</span>
          </div>
          {state.samples.length > 0 ? (
            <ul className="mt-3 divide-y divide-[var(--md-sys-color-outline-variant)] rounded-2xl border border-[var(--md-sys-color-outline-variant)]">
              {state.samples.map((s) => (
                <li key={s.file} className="flex items-center gap-3 px-3 py-2">
                  <MaterialSymbol name="article" size={18} className="shrink-0 text-[var(--md-sys-color-on-surface-variant)]" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">{s.preview || s.file}</p>
                    <p className="text-xs text-[var(--md-sys-color-on-surface-variant)]">writing-samples/{s.file} · {s.words} words</p>
                  </div>
                  {s.mine ? (
                    <button type="button" aria-label={`Remove ${s.file}`} title="Remove" onClick={() => removeSample(s.file)} className="grid size-10 shrink-0 place-items-center rounded-full text-[var(--md-sys-color-on-surface-variant)] hover:bg-[var(--md-sys-color-surface-container-highest)]">
                      <MaterialSymbol name="close" size={18} />
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <div>
          <FieldLabel hint={state.tone ? TONE_HINT[state.tone] : "Not picked yet. Outreach defaults to confident."}>Tone</FieldLabel>
          <Md3Segmented aria-label="Tone" value={(state.tone || "") as Tone} onChange={setTone} options={TONES} />
        </div>

        <div>
          <FieldLabel hint="Outreach will never use these. Press Enter or comma to add.">Never say</FieldLabel>
          {state.neverSay.length > 0 ? (
            <ul className="mb-2 flex flex-wrap gap-2" aria-label="Words you'd never say">
              {state.neverSay.map((w) => (
                <li key={w} className="inline-flex min-h-8 items-center gap-1 rounded-full border border-[var(--md-sys-color-outline-variant)] bg-[var(--md-sys-color-surface-container-high)] py-0.5 pl-3 pr-1 text-sm">
                  <span className="break-all">{w}</span>
                  <button
                    type="button"
                    aria-label={`Remove ${w}`}
                    onClick={() => void saveNever(state.neverSay.filter((n) => n !== w), `"${w}" is allowed again.`)}
                    className="grid size-7 place-items-center rounded-full text-[var(--md-sys-color-on-surface-variant)] hover:bg-[var(--md-sys-color-surface-container-highest)]"
                  >
                    <MaterialSymbol name="close" size={16} />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          <Md3Input
            icon="block"
            aria-label="Add a word you'd never say"
            value={word}
            onChange={(e) => setWord(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === ",") {
                e.preventDefault();
                addWords();
              }
            }}
            onBlur={addWords}
            placeholder="thrilled, rockstar, circle back"
          />
        </div>
      </div>
    </BrainSection>
  );
}
