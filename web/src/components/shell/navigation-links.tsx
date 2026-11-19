"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MaterialSymbol } from "@/components/shell/material-symbol";
import { NAV_ITEMS, isActivePath } from "@/lib/nav-items";

/** One set of destinations for the rail and mobile menu. */
export function NavigationLinks({ layout, onNavigate }: { layout: "sidebar"; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <div className="app-nav-links" data-layout={layout}>
      {NAV_ITEMS.map(({ href, label, icon }) => {
        const active = isActivePath(href, pathname);
        return (
          <Link key={href} href={href} className="app-nav-link" data-active={active} aria-current={active ? "page" : undefined} onClick={onNavigate}>
            <span className="app-nav-icon"><MaterialSymbol name={icon} filled={active} size={22} /></span>
            <span className="app-nav-label">{label}</span>
          </Link>
        );
      })}
    </div>
  );
}
