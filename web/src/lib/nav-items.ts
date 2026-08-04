export type NavItem = {
  href: string;
  label: string;
  icon: string;
  chip?: string;
};

export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Today", icon: "dashboard" },
  { href: "/add", label: "Add job", icon: "link" },
  { href: "/explore", label: "Explore", icon: "explore", chip: "New" },
  { href: "/pipeline", label: "Pipeline", icon: "checklist" },
  { href: "/contacts", label: "Outreach", icon: "group" },
  { href: "/portals", label: "Portals", icon: "radar" },
  { href: "/analytics", label: "Analytics", icon: "bar_chart" },
  { href: "/cv", label: "CV", icon: "description" },
  { href: "/config", label: "Config", icon: "settings" },
];

export function isActivePath(href: string, pathname: string): boolean {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}
