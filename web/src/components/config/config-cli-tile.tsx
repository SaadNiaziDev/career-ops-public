"use client";

import { MaterialSymbol } from "@/components/material-symbol";
import { Md3SelectableCard } from "@/components/ui/md3-selectable-card";
import { cn } from "@/lib/cn";

const CLI_META: Record<string, { icon: string; accent: string; perk?: string }> = {
  claude: { icon: "psychology", accent: "config-cli-tile--claude", perk: "Best experience" },
  codex: { icon: "terminal", accent: "config-cli-tile--codex" },
  cursor: { icon: "edit_square", accent: "config-cli-tile--cursor" },
};

export type ConfigCli = {
  id: string;
  name: string;
  run: string;
  url: string;
  installed: boolean;
  path: string | null;
};

export function ConfigCliTile({
  cli,
  selected,
  onSelect,
}: {
  cli: ConfigCli;
  selected: boolean;
  onSelect: () => void;
}) {
  const meta = CLI_META[cli.id] ?? { icon: "code", accent: "" };

  return (
    <Md3SelectableCard
      selected={selected && cli.installed}
      disabled={!cli.installed}
      onSelect={onSelect}
      className={cn("config-cli-tile", meta.accent, selected && cli.installed && "config-cli-tile--active")}
    >
      <div className="config-cli-tile__body">
        <div className="config-cli-tile__head">
          <span className="config-cli-tile__icon" aria-hidden>
            <MaterialSymbol name={meta.icon} size={24} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="config-cli-tile__name">{cli.name}</span>
              {meta.perk ? <span className="config-cli-tile__perk">{meta.perk}</span> : null}
            </div>
            <code className="config-cli-tile__cmd">{cli.run}</code>
          </div>
          {cli.installed ? (
            <span className={cn("config-cli-tile__status", selected && "config-cli-tile__status--active")}>
              {selected ? "Active" : "Installed"}
            </span>
          ) : (
            <a
              href={cli.url}
              target="_blank"
              rel="noreferrer"
              data-stop-select
              className="config-cli-tile__install"
            >
              Install
              <MaterialSymbol name="open_in_new" size={14} />
            </a>
          )}
        </div>
        {cli.installed && cli.path ? (
          <p className="config-cli-tile__path" title={cli.path}>
            {cli.path}
          </p>
        ) : !cli.installed ? (
          <p className="config-cli-tile__path config-cli-tile__path--muted">Not detected on this machine</p>
        ) : null}
      </div>
    </Md3SelectableCard>
  );
}
