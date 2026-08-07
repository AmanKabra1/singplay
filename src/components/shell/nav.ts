import {
  BarChart3,
  Disc3,
  Heart,
  Home,
  ListMusic,
  Mic2,
  Music4,
  Search,
  Settings,
  Shield,
  User,
  Users,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Redirects guests to sign-in instead of rendering the page. */
  authOnly?: boolean;
};

export type NavSection = { title: string; items: NavItem[] };

export const PRIMARY_NAV: NavSection[] = [
  {
    title: "Browse",
    items: [
      { href: "/", label: "Home", icon: Home },
      { href: "/search", label: "Search", icon: Search },
    ],
  },
  {
    title: "Your library",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: BarChart3, authOnly: true },
      { href: "/library", label: "Favorites", icon: Heart, authOnly: true },
      { href: "/playlists", label: "Playlists", icon: ListMusic, authOnly: true },
      { href: "/practice", label: "Practice", icon: Mic2, authOnly: true },
    ],
  },
  {
    title: "Studio",
    items: [
      { href: "/dj", label: "DJ panel", icon: Disc3, authOnly: true },
      { href: "/sing", label: "Sing Along", icon: Mic2, authOnly: true },
    ],
  },
];

export const ADMIN_NAV: NavSection = {
  title: "Admin",
  items: [
    { href: "/admin", label: "Overview", icon: Shield },
    { href: "/admin/songs", label: "Songs", icon: Music4 },
    { href: "/admin/users", label: "Users", icon: Users },
  ],
};

/** The five destinations that fit a phone tab bar. */
export const MOBILE_TABS: NavItem[] = [
  { href: "/", label: "Home", icon: Home },
  { href: "/search", label: "Search", icon: Search },
  { href: "/sing", label: "Sing", icon: Mic2, authOnly: true },
  { href: "/dj", label: "DJ", icon: Disc3, authOnly: true },
  { href: "/profile", label: "Profile", icon: User },
];

export const ACCOUNT_NAV: NavItem[] = [
  { href: "/profile", label: "Profile & settings", icon: Settings, authOnly: true },
];

/** Marks a nav item active, treating "/" as exact and the rest as prefixes. */
export function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}
