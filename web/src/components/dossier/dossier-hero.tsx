"use client";

import type { ReactNode } from "react";
import { useRef } from "react";
import { Typography, Space } from "antd";
import { useLenis } from "lenis/react";
import { HeroGlow } from "@/components/hero-glow";
import { instrumentSerif } from "@/lib/fonts";
import { cn } from "@/lib/cn";

export function DossierHero({
  eyebrow,
  title,
  description,
  actions,
  footer,
  className,
}: {
  eyebrow: string;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  footer?: ReactNode;
  className?: string;
}) {
  const innerRef = useRef<HTMLDivElement>(null);

  useLenis(({ scroll }) => {
    const el = innerRef.current;
    if (!el) return;
    const y = Math.min(scroll * 0.04, 24);
    el.style.transform = `translate3d(0, ${-y}px, 0)`;
  });

  return (
    <section
      className={cn(
        "dossier-hero dot-bg relative mb-5 overflow-hidden rounded-2xl border border-border bg-surface/50 sm:mb-6",
        className,
      )}
    >
      <HeroGlow />
      <div aria-hidden className="dossier-hero-scrim pointer-events-none absolute inset-0 z-[1]" />
      <div ref={innerRef} className="dossier-hero-inner relative z-10 will-change-transform">
        <Typography.Text type="secondary" className="font-mono text-[11px] uppercase tracking-[0.2em]">
          {eyebrow}
        </Typography.Text>
        <Typography.Title
          level={2}
          className={cn(instrumentSerif.className, "mb-2! mt-3! max-w-2xl font-normal tracking-tight text-landing!")}
        >
          {title}
        </Typography.Title>
        {description && (
          <Typography.Paragraph type="secondary" className="mb-0! max-w-xl text-[15px] leading-relaxed">
            {description}
          </Typography.Paragraph>
        )}
        {actions && <Space wrap className="mt-5">{actions}</Space>}
        {footer && <div className="mt-5 border-t border-border/60 pt-5">{footer}</div>}
      </div>
    </section>
  );
}
