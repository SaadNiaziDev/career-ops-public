"use client";

import { useEffect, useState } from "react";
import {
  CheckCircleOutlined,
  CodeOutlined,
  ExportOutlined,
  KeyOutlined,
  LoadingOutlined,
  MinusCircleOutlined,
} from "@ant-design/icons";
import {
  Alert,
  Button,
  Card,
  Empty,
  Radio,
  Space,
  Switch,
  Typography,
} from "antd";
import { PageShell } from "@/components/dossier/page-shell";
import { DossierPageHeader } from "@/components/dossier/dossier-page-header";
import { DossierSection } from "@/components/dossier/dossier-section";
import { DossierStack } from "@/components/dossier/dossier-stack";
import { readCliConfig, writeCliConfig, CONFIG_KEY } from "@/lib/cli-config";

const { Text, Paragraph } = Typography;

type Cli = {
  id: string;
  name: string;
  run: string;
  url: string;
  installed: boolean;
  path: string | null;
};

type Mode = "cli" | "key" | "manual";

const STORAGE_KEY = CONFIG_KEY;

export function ConfigForm() {
  const [mode, setMode] = useState<Mode>("cli");
  const [clis, setClis] = useState<Cli[] | null>(null);
  const [cliId, setCliId] = useState<string>("");
  const [provider, setProvider] = useState("anthropic");
  const [apiKey, setApiKey] = useState("");
  const [logos, setLogos] = useState(true);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const v = JSON.parse(raw);
        if (v.mode === "cli") setMode("cli");
        if (v.cliId) setCliId(v.cliId);
        if (v.provider) setProvider(v.provider);
        if (typeof v.logos === "boolean") setLogos(v.logos);
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    fetch("/api/clis")
      .then((r) => r.json())
      .then((d) => {
        const list: Cli[] = d.clis ?? [];
        setClis(list);
        const savedCli = readCliConfig().cliId;
        const savedOk = savedCli && list.some((c) => c.id === savedCli && c.installed);
        if (savedOk) {
          setCliId(savedCli);
          return;
        }
        const first = list.find((c) => c.installed)?.id || "";
        setCliId(first);
        if (first) writeCliConfig({ cliId: first, mode: "cli" });
      })
      .catch(() => setClis([]));
  }, []);

  function save() {
    writeCliConfig({ mode, cliId, provider, logos });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  const installed = clis?.filter((c) => c.installed) ?? [];

  return (
    <PageShell width="narrow">
      <DossierStack>
        <DossierPageHeader
          title="Config"
          description="Run career-ops on your own AI, right on your computer. Your CV and data never leave your machine."
        />

        <DossierSection title="AI Engine">
          <Radio.Group
            value={mode}
            onChange={(e) => setMode(e.target.value as Mode)}
            className="w-full"
          >
            <Space direction="vertical" className="w-full" size={10}>
            <Radio.Button value="cli" className="!h-auto !w-full !text-left !px-4 !py-3">
              <Space>
                <CodeOutlined />
                <span>
                  <Text strong>Use an AI tool you have</Text>
                  <br />
                  <Text type="secondary" className="text-xs">
                    Recommended
                  </Text>
                </span>
              </Space>
            </Radio.Button>
            <Radio.Button value="key" disabled className="!h-auto !w-full !text-left !px-4 !py-3">
              <Space>
                <KeyOutlined />
                <span>
                  <Text strong>Paste an AI key</Text>
                  <br />
                  <Text type="secondary" className="text-xs">
                    Coming soon
                  </Text>
                </span>
              </Space>
            </Radio.Button>
            <Radio.Button value="manual" disabled className="!h-auto !w-full !text-left !px-4 !py-3">
              <Space>
                <MinusCircleOutlined />
                <span>
                  <Text strong>No setup needed</Text>
                  <br />
                  <Text type="secondary" className="text-xs">
                    Coming soon
                  </Text>
                </span>
              </Space>
            </Radio.Button>
          </Space>
          </Radio.Group>

          {mode === "cli" && (
            <>
              <Paragraph type="secondary" className="mb-0!">
                career-ops uses an AI tool you already have — signed in, your own usage, nothing to paste.
              </Paragraph>
              <Text type="secondary" className="text-xs">
                Works with Claude Code, Codex, Cursor, and more — free ones work great.
              </Text>
              {clis === null ? (
                <div>
                  <LoadingOutlined spin /> <Text type="secondary">Checking what&apos;s on your computer…</Text>
                </div>
              ) : installed.length === 0 ? (
                <Alert
                  type="info"
                  showIcon
                  message={
                    <>
                      No AI tool yet? Free options like OpenCode with Qwen or GLM work great.{" "}
                      <a href="https://career-ops.org/docs/free-ai-engine" target="_blank" rel="noreferrer">
                        Get one free <ExportOutlined />
                      </a>
                    </>
                  }
                />
              ) : (
                <Space direction="vertical" className="w-full" size={10}>
                  {clis.map((c) => {
                    const selected = c.id === cliId;
                    return (
                      <Card
                        key={c.id}
                        size="small"
                        className={selected ? "border-[var(--ant-color-primary)]" : undefined}
                      >
                        <div className="flex flex-wrap items-center gap-4">
                          {c.installed ? (
                            <CheckCircleOutlined className="text-emerald-500" />
                          ) : (
                            <MinusCircleOutlined className="text-[var(--ant-color-text-secondary)]" />
                          )}
                          <Button
                            type={selected ? "primary" : "text"}
                            disabled={!c.installed}
                            onClick={() => {
                              setCliId(c.id);
                              writeCliConfig({ cliId: c.id, mode: "cli" });
                            }}
                            className="flex-1 justify-start"
                          >
                            <span className="font-medium">{c.name}</span>
                            <Text code className="ml-2 text-xs">
                              {c.run}
                            </Text>
                          </Button>
                          {c.installed ? (
                            <Text type="secondary" className="hidden max-w-[40%] truncate text-xs sm:block">
                              {c.path}
                            </Text>
                          ) : (
                            <Button
                              type="link"
                              size="small"
                              href={c.url}
                              target="_blank"
                              rel="noreferrer"
                              icon={<ExportOutlined />}
                            >
                              Install
                            </Button>
                          )}
                        </div>
                      </Card>
                    );
                  })}
                  <Text type="secondary" className="text-xs">
                    Best on Claude Code (live progress, agentic apply + AI search, reliable evaluation persistence).
                    Other CLIs work for the core flows with reduced features.
                  </Text>
                </Space>
              )}
            </>
          )}

          {mode === "key" && <Empty description="API key mode is on the roadmap." />}

          {mode === "manual" && (
            <Alert type="info" showIcon message="The easiest way in — no keys, nothing to set up. On the roadmap." />
          )}
        </DossierSection>

        <DossierSection title="Appearance">
          <div className="flex items-center justify-between gap-6">
            <div className="min-w-0">
              <Text strong>Company logos</Text>
              <Paragraph type="secondary" className="mb-0! text-xs">
                Show each company&apos;s real logo. Fetched once through your local server and cached on disk — only the
                employer domain is sent to a third party. Off = colored monograms only.
              </Paragraph>
            </div>
            <Switch checked={logos} onChange={setLogos} />
          </div>
        </DossierSection>

        <Space size="middle">
          <Button type="primary" size="large" onClick={save}>
            {saved ? "Saved" : "Save config"}
          </Button>
          <Text type="secondary" className="text-xs">
            Local-first · on our roadmap
          </Text>
        </Space>
      </DossierStack>
    </PageShell>
  );
}
