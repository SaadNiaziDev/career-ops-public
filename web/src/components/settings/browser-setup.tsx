"use client";

import { useEffect, useState } from "react";

export function BrowserSetup() {
  const [url, setUrl] = useState("");
  const [managed, setManaged] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/settings/browser", { signal: controller.signal }).then(async (response) => {
      if (!response.ok) throw new Error("Could not load browser settings. Reload to retry.");
      const data = await response.json();
      setUrl(data.url);
      setManaged(data.managed);
    }).catch((e) => { if (!controller.signal.aborted) setError(e.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, []);

  async function save() {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/settings/browser", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not connect to Chrome.");
      setUrl(data.url);
      setMessage(data.message);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not connect to Chrome.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="apply-card settings-card mt-4" aria-label="Application browser setup">
      <h2 className="md-title-medium">Application browser · optional</h2>
      <p className="apply-muted">Connect the Chrome profile you use for applications to keep its signed-in sessions when reading and prefilling forms. You review and submit.</p>
      <p className="apply-muted mt-2">Installed Claude or ChatGPT browser extensions are not connected to Career-Ops. This app currently supports a Chrome remote debugging connection.</p>
      <details className="mt-3 text-sm">
        <summary>How to connect Chrome</summary>
        <p className="mt-2">Use a Chrome instance already configured for remote debugging and enter its local HTTP address below. Use the profile where you signed in to the application sites. Enabling debugging in a separate profile will not transfer your existing logins.</p>
        <p className="mt-2">Chrome 136 and newer require a non-default profile when launched with a remote debugging port. Keep the endpoint on this computer: it allows control of that browser profile. Extensions alone do not provide this address. <a className="underline" href="https://developer.chrome.com/blog/remote-debugging-port" target="_blank" rel="noreferrer">Chrome connection requirements</a>.</p>
        <p className="mt-2">Without a connection, Open application uses your current browser; automatic prefill uses a separate Chrome profile. Existing application sessions must be reopened after changing this setting.</p>
      </details>
      <label className="settings-field mt-3">
        <span>Local Chrome debugging URL</span>
        <input type="url" placeholder="http://127.0.0.1:9222" value={url} disabled={loading || saving || managed} onChange={(e) => { setUrl(e.target.value); setMessage(""); }} />
        <small>{managed ? "Configured by CAREER_OPS_CHROME_CDP_URL." : "Leave empty to use a separate Chrome profile for prefill."}</small>
      </label>
      <button type="button" className="md3-action-btn md3-action-btn--outlined mt-3" disabled={loading || saving || managed} onClick={() => void save()}>{saving ? "Checking…" : "Test and save connection"}</button>
      {error && <p role="alert" className="search-error">{error}</p>}
      {message && <p role="status" className="apply-muted mt-2">{message}</p>}
    </section>
  );
}
