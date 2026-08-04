"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MaterialSymbol } from "@/components/material-symbol";
import { CoMark } from "@/components/co-mark";
import { NAV_ITEMS, isActivePath } from "@/lib/nav-items";

export function NavigationRail() {
  const pathname = usePathname();

  return (
    <nav className="md3-rail sticky top-0 h-screen shrink-0" aria-label="Primary">
      <Link href="/" className="md3-rail-mark" aria-label="career-ops home">
        <CoMark size={28} />
      </Link>
      {NAV_ITEMS.map(({ href, label, icon }) => {
        const active = isActivePath(href, pathname);
        return (
          <Link
            key={href}
            href={href}
            className="md3-rail-item"
            data-active={active ? "true" : "false"}
            aria-current={active ? "page" : undefined}
          >
            <span className="md3-rail-pill">
              <MaterialSymbol
                name={icon}
                filled={active}
                size={24}
                className={active ? "text-[var(--md-sys-color-on-secondary-container)]" : "text-[var(--md-sys-color-on-surface-variant)]"}
              />
            </span>
            <span className="md3-rail-label">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
