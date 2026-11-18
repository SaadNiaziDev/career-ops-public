export type NavItem = {
  href: string;
  label: string;
  icon: string;
};

export const PRIMARY_NAV_ITEMS: NavItem[] = [
  { href: "/explore", label: "Search", icon: "search" },
  { href: "/apply", label: "Apply", icon: "task_alt" },
  { href: "/pipeline", label: "Track", icon: "history" },
];

export const TOOL_NAV_ITEMS: NavItem[] = [
  { href: "/today", label: "Today", icon: "dashboard" },
  { href: "/brain", label: "Brain", icon: "psychology" },
  { href: "/contacts", label: "Contacts", icon: "group" },
  { href: "/portals", label: "Portals", icon: "radar" },
  { href: "/analytics", label: "Analytics", icon: "bar_chart" },
  { href: "/cv", label: "CV", icon: "description" },
  { href: "/config", label: "Config", icon: "settings" },
];

// Keep every destination available to command search, including collapsed tools.
export const NAV_ITEMS = [...PRIMARY_NAV_ITEMS, ...TOOL_NAV_ITEMS];

export function isActivePath(href: string, pathname: string): boolean {
  return pathname === href || (href !== "/" && pathname.startsWith(`${href}/`));
}
