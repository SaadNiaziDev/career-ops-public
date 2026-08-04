"use client";

import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { MaterialSymbol } from "@/components/material-symbol";
import { PageShell } from "@/components/dossier/page-shell";
import { DossierPageHeader } from "@/components/dossier/dossier-page-header";
import { DossierStack } from "@/components/dossier/dossier-stack";
import { Button } from "@/components/ui/button";
import { Md3Card } from "@/components/ui/md3-card";
import { Md3Textarea } from "@/components/ui/md3-input";

export function CvEditor() {
  const [content, setContent] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [exists, setExists] = useState(true);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/cv")
      .then((r) => r.json())
      .then((d) => {
        setContent(d.content ?? "");
        setExists(d.exists ?? false);
      })
      .finally(() => setLoaded(true));
  }, []);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/cv", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      if (res.ok) {
        setDirty(false);
        setExists(true);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <PageShell width="default">
      <DossierStack>
        <DossierPageHeader
          title="CV editor"
          description={
            <>
              Edit <code className="rounded bg-[var(--md-sys-color-surface-container-high)] px-1.5 py-0.5 text-sm">cv.md</code> with live preview.
              {!exists && loaded && (
                <span className="ml-1 text-[var(--md-sys-color-on-surface-variant)]">
                  No cv.md yet — start typing to create it.
                </span>
              )}
            </>
          }
          extra={
            <Button variant={dirty ? "primary" : "outline"} size="default" onClick={save} disabled={saving || !dirty}>
              {saving ? (
                <MaterialSymbol name="progress_activity" size={18} className="animate-spin" />
              ) : saved ? (
                <MaterialSymbol name="check" size={18} />
              ) : null}
              {saved ? "Saved" : "Save"}
            </Button>
          }
        />

        {!loaded ? (
          <div className="flex justify-center py-16">
            <MaterialSymbol name="progress_activity" size={32} className="animate-spin text-[var(--md-sys-color-primary)]" />
          </div>
        ) : (
          <div className="grid gap-5 lg:grid-cols-2">
            <Md3Textarea
              value={content}
              onChange={(e) => {
                setContent(e.target.value);
                setDirty(true);
              }}
              spellCheck={false}
              placeholder={"# Your Name\n\n## Summary\n..."}
              rows={24}
              className="font-mono"
            />
            <Md3Card className="min-h-[60vh]">
              <article className="report-prose">
                {content.trim() ? (
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
                ) : (
                  <p className="text-[var(--md-sys-color-on-surface-variant)]">Preview appears here.</p>
                )}
              </article>
            </Md3Card>
          </div>
        )}
      </DossierStack>
    </PageShell>
  );
}
