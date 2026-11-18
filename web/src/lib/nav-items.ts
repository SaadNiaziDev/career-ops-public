export type NavItem = {
  href: string;
  label: string;
  icon: string;
};

export const NAV_ITEMS: NavItem[] = [
  { href: "/explore", label: "Search", icon: "search" },
  { href: "/apply", label: "Apply", icon: "task_alt" },
  { href: "/pipeline", label: "Track", icon: "history" },
  { href: "/brain", label: "Brain", icon: "psychology" },
  { href: "/config", label: "Settings", icon: "settings" },
];

export function isActivePath(href: string, pathname: string): boolean {
  return pathname === href || (href !== "/" && pathname.startsWith(`${href}/`));
}
