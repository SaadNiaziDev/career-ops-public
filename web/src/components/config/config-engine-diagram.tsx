"use client";

import { MaterialSymbol } from "@/components/material-symbol";
import { cn } from "@/lib/cn";

export function ConfigEngineDiagram({
  cliName,
  cliReady,
  logos,
}: {
  cliName?: string;
  cliReady: boolean;
  logos: boolean;
}) {
  return (
    <div className="config-engine-diagram" aria-label="How career-ops connects on your machine">
      <div className="config-engine-node" data-kind="local">
        <span className="config-engine-node__icon" aria-hidden>
          <MaterialSymbol name="folder_open" size={22} />
        </span>
        <span className="config-engine-node__title">Your files</span>
        <span className="config-engine-node__meta">cv.md · pipeline · reports</span>
        <span className="config-engine-node__badge">
          <MaterialSymbol name="lock" size={14} />
          local only
        </span>
      </div>

      <div className="config-engine-connector" aria-hidden>
        <span className="config-engine-connector__line" />
        <MaterialSymbol name="arrow_forward" size={18} className="config-engine-connector__arrow" />
      </div>

      <div className="config-engine-node" data-kind="hub">
        <span className="config-engine-node__icon" aria-hidden>
          <MaterialSymbol name="hub" size={22} />
        </span>
        <span className="config-engine-node__title">career-ops</span>
        <span className="config-engine-node__meta">orchestrates modes &amp; workers</span>
        <span className="config-engine-node__badge">
          <MaterialSymbol name="dashboard" size={14} />
          this UI
        </span>
      </div>

      <div className={cn("config-engine-connector", cliReady && "config-engine-connector--live")} aria-hidden>
        <span className="config-engine-connector__line" />
        <MaterialSymbol name="arrow_forward" size={18} className="config-engine-connector__arrow" />
      </div>

      <div className="config-engine-node" data-kind="cli" data-ready={cliReady ? "true" : "false"}>
        <span className="config-engine-node__icon" aria-hidden>
          <MaterialSymbol name={cliReady ? "bolt" : "help"} size={22} filled={cliReady} />
        </span>
        <span className="config-engine-node__title">{cliName ?? "Pick a worker"}</span>
        <span className="config-engine-node__meta">{cliReady ? "signed in on your machine" : "waiting for a CLI"}</span>
        <span className={cn("config-engine-node__badge", cliReady && "config-engine-node__badge--live")}>
          <MaterialSymbol name={cliReady ? "check_circle" : "schedule"} size={14} filled={cliReady} />
          {cliReady ? "engine ready" : "setup needed"}
        </span>
      </div>

      <div className="config-engine-footnote">
        <span className="config-engine-footnote__item">
          <MaterialSymbol name="image" size={16} />
          Logos {logos ? "on" : "off"}
        </span>
        <span className="config-engine-footnote__item">
          <MaterialSymbol name="cloud_off" size={16} />
          No cloud account required
        </span>
      </div>
    </div>
  );
}
