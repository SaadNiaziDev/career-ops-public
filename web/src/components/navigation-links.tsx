"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MaterialSymbol } from "@/components/material-symbol";
import { PRIMARY_NAV_ITEMS, TOOL_NAV_ITEMS, isActivePath, type NavItem } from "@/lib/nav-items";

/** One set of destinations and disclosure behavior for the rail and mobile menu. */
export function NavigationLinks({ layout, onNavigate }: { layout: "rail" | "drawer"; onNavigate?: () => void }) {
  const pathname = usePathname();
  const toolsActive = TOOL_NAV_ITEMS.some(({ href }) => isActivePath(href, pathname));

  const renderLink = ({ href, label, icon }: NavItem) => {
    const active = isActivePath(href, pathname);
    return (
      <Link key={href} href={href} className="app-nav-link" data-active={active} aria-current={active ? "page" : undefined} onClick={onNavigate}>
        <span className="app-nav-icon"><MaterialSymbol name={icon} filled={active} size={24} /></span>
        <span className="app-nav-label">{label}</span>
      </Link>
    );
  };

  return (
    <div className="app-nav-links" data-layout={layout}>
      {PRIMARY_NAV_ITEMS.map(renderLink)}
      <details className="app-nav-tools" key={toolsActive ? "tools" : "primary"} open={toolsActive}>
        <summary className="app-nav-link" data-active={toolsActive}>
          <span className="app-nav-icon"><MaterialSymbol name="more_horiz" size={24} /></span>
          <span className="app-nav-label">Tools</span>
        </summary>
        <div className="app-nav-tool-links">{TOOL_NAV_ITEMS.map(renderLink)}</div>
      </details>
    </div>
  );
}
