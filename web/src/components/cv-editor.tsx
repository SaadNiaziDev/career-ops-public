"use client";

import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { CheckOutlined, LoadingOutlined } from "@ant-design/icons";
import { Button, Card, Col, Input, Row, Spin, Typography } from "antd";
import { PageShell } from "@/components/dossier/page-shell";
import { DossierPageHeader } from "@/components/dossier/dossier-page-header";
import { DossierStack } from "@/components/dossier/dossier-stack";

const { Text } = Typography;
const { TextArea } = Input;

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
              Edit <Text code>cv.md</Text> with live preview.
              {!exists && loaded && (
                <Text type="secondary" className="ml-1">
                  No cv.md yet — start typing to create it.
                </Text>
              )}
            </>
          }
          extra={
            <Button
              type={dirty ? "primary" : "default"}
              size="large"
              onClick={save}
              disabled={saving || !dirty}
              icon={saving ? <LoadingOutlined spin /> : saved ? <CheckOutlined /> : undefined}
            >
              {saved ? "Saved" : "Save"}
            </Button>
          }
        />

        {!loaded ? (
          <div className="flex justify-center py-16">
            <Spin size="large" />
          </div>
        ) : (
          <Row gutter={[20, 20]}>
            <Col xs={24} lg={12}>
              <TextArea
                value={content}
                onChange={(e) => {
                  setContent(e.target.value);
                  setDirty(true);
                }}
                spellCheck={false}
                placeholder={"# Your Name\n\n## Summary\n..."}
                autoSize={{ minRows: 24 }}
                className="font-mono"
                style={{ padding: "16px 18px", lineHeight: 1.6 }}
              />
            </Col>
            <Col xs={24} lg={12}>
              <Card className="min-h-[60vh]">
                <article className="report-prose">
                  {content.trim() ? (
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
                  ) : (
                    <Text type="secondary">Preview appears here.</Text>
                  )}
                </article>
              </Card>
            </Col>
          </Row>
        )}
      </DossierStack>
    </PageShell>
  );
}
