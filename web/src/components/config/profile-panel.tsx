"use client";

import { useEffect, useState } from "react";
import { MaterialSymbol } from "@/components/material-symbol";

// The Config face on config/profile.yml. Only the fields this endpoint owns are
// shown — archetypes and narrative stay in modes/_profile.md, where the agent
// edits them, and are deliberately not editable here.

type Profile = {
  name?: string;
  email?: string;
  location?: string;
  roles?: string[];
  compMin?: number;
  compMax?: number;
  currency?: string;
  remote?: string;
};

const REMOTE_OPTIONS = ["remote", "hybrid", "onsite", "flexible"];

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-[13px] font-medium">{label}</span>
      <div className="md3-field mt-1.5">{children}</div>
      {hint && <span className="mt-1 block text-[11px] text-[var(--md-sys-color-outline)]">{hint}</span>}
    </label>
  );
}

export function ProfilePanel() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [saved, setSaved] = useState<Profile | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    fetch("/api/profile")
      .then((r) => r.json())
      .then((d: { profile?: Profile }) => {
        if (!live) return;
        setProfile(d.profile ?? {});
        setSaved(d.profile ?? {});
      })
      .catch(() => {
        if (!live) return;
        setProfile({});
        setSaved({});
      });
    return () => {
      live = false;
    };
  }, []);

  if (!profile || !saved) return <div className="config-panel__loading">Reading config/profile.yml…</div>;

  const dirty = JSON.stringify(profile) !== JSON.stringify(saved);
  const set = (patch: Profile) => setProfile({ ...profile, ...patch });

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/profile", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(profile),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error || "write failed");
      setSaved(profile);
    } catch (e) {
      setError(e instanceof Error ? e.message : "write failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Full name">
          <input
            className="md3-field__input text-sm"
            value={profile.name ?? ""}
            onChange={(e) => set({ name: e.target.value })}
            placeholder="Name on the CV"
          />
        </Field>
        <Field label="Email">
          <input
            className="md3-field__input text-sm"
            type="email"
            value={profile.email ?? ""}
            onChange={(e) => set({ email: e.target.value })}
            placeholder="you@example.com"
          />
        </Field>
        <Field label="Location">
          <input
            className="md3-field__input text-sm"
            value={profile.location ?? ""}
            onChange={(e) => set({ location: e.target.value })}
            placeholder="Lahore, Pakistan"
          />
        </Field>
        <Field label="Location flexibility">
          <select
            className="md3-field__input bg-transparent text-sm"
            value={profile.remote ?? ""}
            onChange={(e) => set({ remote: e.target.value })}
          >
            <option value="">—</option>
            {REMOTE_OPTIONS.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="Target roles" hint="Comma separated — seeds the scan and the Explore filter builder">
        <input
          className="md3-field__input text-sm"
          value={(profile.roles ?? []).join(", ")}
          onChange={(e) =>
            set({
              roles: e.target.value
                .split(",")
                .map((r) => r.trim())
                .filter(Boolean),
            })
          }
          placeholder="Senior Software Engineer, Full Stack Engineer"
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Comp min">
          <input
            className="md3-field__input font-mono text-sm tabular-nums"
            inputMode="numeric"
            value={profile.compMin ?? ""}
            onChange={(e) => set({ compMin: Number(e.target.value) || undefined })}
          />
        </Field>
        <Field label="Comp max">
          <input
            className="md3-field__input font-mono text-sm tabular-nums"
            inputMode="numeric"
            value={profile.compMax ?? ""}
            onChange={(e) => set({ compMax: Number(e.target.value) || undefined })}
          />
        </Field>
        <Field label="Currency">
          <input
            className="md3-field__input text-sm uppercase"
            maxLength={3}
            value={profile.currency ?? ""}
            onChange={(e) => set({ currency: e.target.value.toUpperCase() })}
            placeholder="USD"
          />
        </Field>
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-[var(--md-sys-color-outline-variant)] pt-4">
        <p className="min-w-0 flex-1 text-xs text-[var(--md-sys-color-outline)]">
          Archetypes, narrative and proof points stay in <code className="font-mono">modes/_profile.md</code> — this
          panel never touches them.
        </p>
        <button type="button" className="md3-btn-filled min-h-10" onClick={save} disabled={!dirty || busy}>
          {busy ? (
            "Writing…"
          ) : dirty ? (
            "Write to profile.yml"
          ) : (
            <>
              <MaterialSymbol name="check" size={18} />
              Saved
            </>
          )}
        </button>
      </div>
      {error && <p className="text-xs text-[var(--md-sys-color-error)]">Could not write profile.yml — {error}</p>}
    </div>
  );
}
