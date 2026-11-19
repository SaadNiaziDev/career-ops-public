"use client";

import { useEffect, useState } from "react";
import { MaterialSymbol } from "@/components/shell/material-symbol";
import type { ProfileFields } from "@/lib/profile-fields";

type TextKey = "name" | "email" | "location" | "country" | "timezone" | "visa" | "compRange" | "minimum" | "currency" | "remote";
type ListKey = "roles" | "dealBreakers";

const TEXT_FIELDS: { key: TextKey; label: string; placeholder: string }[] = [
  { key: "name", label: "Full name", placeholder: "As on your CV" },
  { key: "email", label: "Email", placeholder: "you@example.com" },
  { key: "location", label: "Where you live", placeholder: "Lahore, Pakistan" },
  { key: "timezone", label: "Time zone", placeholder: "Asia/Karachi" },
  { key: "visa", label: "Work authorization", placeholder: "e.g. Pakistani citizen, needs sponsorship abroad" },
  { key: "remote", label: "Location preference", placeholder: "Remote preferred; relocation to UAE OK" },
  { key: "compRange", label: "Target pay", placeholder: "e.g. 60k-80k" },
  { key: "minimum", label: "Lowest acceptable pay", placeholder: "e.g. 50k" },
  { key: "currency", label: "Currency", placeholder: "USD" },
];

const lines = (text: string) => text.split("\n").map((l) => l.trim()).filter(Boolean);

/** The facts every evaluation, CV and email uses. Saved to config/profile.yml. */
export function ProfileForm() {
  const [saved, setSaved] = useState<ProfileFields | null>(null);
  const [form, setForm] = useState<ProfileFields>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let live = true;
    fetch("/api/profile")
      .then((r) => r.json())
      .then((d: { profile?: ProfileFields }) => {
        if (!live) return;
        setSaved(d.profile ?? {});
        setForm(d.profile ?? {});
      })
      .catch(() => live && setError("Could not read your profile."));
    return () => { live = false; };
  }, []);

  const changed = saved
    ? ([...TEXT_FIELDS.map((f) => f.key), "roles", "dealBreakers"] as (keyof ProfileFields)[]).filter((k) => JSON.stringify(form[k] ?? "") !== JSON.stringify(saved[k] ?? ""))
    : [];

  async function save() {
    setBusy(true);
    setError("");
    try {
      const patch = Object.fromEntries(changed.map((k) => [k, form[k] ?? (k === "roles" || k === "dealBreakers" ? [] : "")]));
      const res = await fetch("/api/profile", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Could not save.");
      setSaved({ ...form });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  }

  const list = (key: ListKey, label: string, hint: string) => (
    <label className="settings-field">
      <span>{label}</span>
      <textarea rows={4} value={(form[key] ?? []).join("\n")} onChange={(e) => setForm((f) => ({ ...f, [key]: lines(e.target.value) }))} />
      <small>{hint}</small>
    </label>
  );

  return (
    <section className="apply-card settings-card" aria-label="Profile">
      <div className="settings-card__head">
        <div>
          <h2 className="md-title-medium">You</h2>
          <p className="apply-muted">Facts the AI uses in every evaluation, CV and email.</p>
        </div>
        <button type="button" className="md3-action-btn md3-action-btn--filled" onClick={() => void save()} disabled={!changed.length || busy}>
          <MaterialSymbol name={changed.length ? "save" : "check"} size={18} />
          <span className="md3-action-btn__label">{busy ? "Saving…" : changed.length ? "Save" : "Saved"}</span>
        </button>
      </div>
      {!saved ? (
        <p className="apply-muted">Loading…</p>
      ) : (
        <>
          <div className="settings-fields">
            {TEXT_FIELDS.map((f) => (
              <label key={f.key} className="settings-field">
                <span>{f.label}</span>
                <input className="settings-input" value={(form[f.key] as string | undefined) ?? ""} placeholder={f.placeholder} onChange={(e) => setForm((v) => ({ ...v, [f.key]: e.target.value }))} />
              </label>
            ))}
          </div>
          <div className="settings-fields settings-fields--two">
            {list("roles", "Roles you want", "One per line. Evaluations score fit against these.")}
            {list("dealBreakers", "Deal-breakers", "One per line, e.g. onsite only in the US.")}
          </div>
        </>
      )}
      {error && <p className="search-error">{error}</p>}
    </section>
  );
}
