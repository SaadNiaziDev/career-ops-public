import { SettingsView } from "@/components/settings/settings-view";
import { careerOpsRoot } from "@/lib/career-ops";
import { detectClis } from "@/lib/clis";
import { getKv } from "@/lib/db";
import { readSearchSettings } from "@/lib/search/settings";

export const dynamic = "force-dynamic";

export default function SettingsPage() {
  const engines = detectClis().map((c) => ({ id: c.id, name: c.name, installed: c.installed }));
  const saved = getKv("ai.engine");
  const engine = engines.find((e) => e.id === saved && e.installed)?.id ?? engines.find((e) => e.installed)?.id ?? null;
  return <SettingsView engines={engines} engine={engine} search={readSearchSettings()} dataDir={careerOpsRoot()} />;
}
