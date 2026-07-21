"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "antd";
import type { MenuProps } from "antd";
import { cn } from "@/lib/cn";
import { CoMark } from "@/components/co-mark";
import { MobileNav } from "@/components/mobile-nav";
import { ThemeToggle } from "@/components/theme-toggle";
import { JobsProvider } from "@/components/jobs/job-store";
import { PipelineProvider } from "@/components/pipeline/pipeline-provider";
import { ApplyProvider } from "@/components/apply/apply-provider";
import { ExploreProvider } from "@/components/explore/explore-provider";
import { FirstScoreView } from "@/components/explore/first-score-view";
import { BetaBanner } from "@/components/beta/beta-banner";
import { WorkerPills } from "@/components/jobs/worker-pills";
import { UsageMeter } from "@/components/usage-meter";
import { instrumentSerif } from "@/lib/fonts";
import { NAV_ITEMS, isActivePath } from "@/lib/nav-items";
import { ScrollProgress } from "@/components/dossier/scroll-progress";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const menuItems: MenuProps["items"] = NAV_ITEMS.map(({ href, label, icon: Icon, chip }) => ({
    key: href,
    icon: <Icon className="size-4" />,
    label: (
      <Link href={href} className="flex items-center gap-2">
        {label}
        {chip && (
          <span className="ml-auto rounded-full border border-brand/30 bg-brand-soft px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-brand-text">
            {chip}
          </span>
        )}
      </Link>
    ),
  }));

  const selectedKey = NAV_ITEMS.find((item) => isActivePath(item.href, pathname))?.href ?? "/";

  return (
    <JobsProvider>
      <PipelineProvider>
      <ApplyProvider>
      <ExploreProvider>
      <ScrollProgress />
      <MobileNav />
      <div className="flex min-h-screen">
        <aside
          data-lenis-prevent
          className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col overflow-y-auto border-r border-border bg-surface/30 p-4 md:flex"
        >
          <Link href="/" className="mb-6 flex items-center gap-2.5 px-1">
            <CoMark size={32} />
            <span className={cn(instrumentSerif.className, "relative -top-px text-2xl font-normal tracking-tight text-landing")}>
              career-ops
            </span>
          </Link>
          <p className="mb-4 px-2 font-mono text-[10px] uppercase tracking-[0.16em] text-faint">Job search dossier</p>
          <Menu
            mode="inline"
            selectedKeys={[selectedKey]}
            items={menuItems}
            className="!border-none !bg-transparent flex-1"
          />

          <WorkerPills />

          <div className="mt-auto space-y-3 pt-4">
            <UsageMeter />
            <div className="flex items-center justify-between px-1">
              <span className={cn(instrumentSerif.className, "text-sm text-faint")}>local-first</span>
              <ThemeToggle />
            </div>
          </div>
        </aside>
        <main className="flex-1 overflow-x-hidden">{children}</main>
        <FirstScoreView />
        <BetaBanner />
      </div>
      </ExploreProvider>
      </ApplyProvider>
      </PipelineProvider>
    </JobsProvider>
  );
}
