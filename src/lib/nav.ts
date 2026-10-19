/**
 * Navigation from the last section of docs/screens-and-journeys.md:
 *   Sidebar (global): Home · Insights · Leads · Projects · Finance · Team, with Org Settings at the bottom.
 *   Sidebar (project): Overview · Files · BOQ · Finance · Home budget · Milestones & DPR
 *   (sub-nav: Gantt chart, Daily reports, Progress by BOQ line) · Snags.
 * Approvals is not in the sidebar; the top bar carries "n to approve" and the bell.
 * Handover and History sit in the project menu (UI spec 3).
 */

export type NavIcon =
  | "home"
  | "insights"
  | "leads"
  | "projects"
  | "finance"
  | "team"
  | "settings"
  | "overview"
  | "files"
  | "boq"
  | "budget"
  | "milestones"
  | "snags"
  | "approvals"
  | "plus"
  | "me";

export type NavItem = {
  label: string;
  href: string;
  icon: NavIcon;
  /** Extra paths that also mark this item active (its sub-pages). */
  matches?: string[];
  children?: { label: string; href: string }[];
};

export type Tab = { label: string; href: string };

export const GLOBAL_NAV: NavItem[] = [
  { label: "Home", href: "/", icon: "home", matches: ["/notifications"] },
  { label: "Insights", href: "/insights", icon: "insights" },
  { label: "Leads", href: "/leads", icon: "leads" },
  { label: "Projects", href: "/projects", icon: "projects" },
  { label: "Finance", href: "/finance", icon: "finance" },
  { label: "Team", href: "/team", icon: "team" },
];

export const GLOBAL_NAV_FOOTER: NavItem = { label: "Org Settings", href: "/settings", icon: "settings" };

export function projectNav(id: string): NavItem[] {
  const base = `/projects/${id}`;
  return [
    { label: "Overview", href: base, icon: "overview" },
    { label: "Files", href: `${base}/files`, icon: "files" },
    { label: "BOQ", href: `${base}/boq`, icon: "boq" },
    { label: "Finance", href: `${base}/finance`, icon: "finance" },
    { label: "Home budget", href: `${base}/home-budget`, icon: "budget" },
    {
      label: "Milestones & DPR",
      href: `${base}/milestones`,
      icon: "milestones",
      children: [
        { label: "Gantt chart", href: `${base}/milestones` },
        { label: "Daily reports (DPR)", href: `${base}/milestones/dpr` },
        { label: "Progress by BOQ line", href: `${base}/milestones/progress` },
      ],
    },
    { label: "Snags", href: `${base}/snags`, icon: "snags" },
  ];
}

export function projectMenu(id: string): Tab[] {
  const base = `/projects/${id}`;
  return [
    { label: "Handover", href: `${base}/handover` },
    { label: "History", href: `${base}/history` },
  ];
}

/** Phone bottom bar: five items, the centre one for quick actions (UI spec 3, reference 00-app-shell). */
export const BOTTOM_NAV: NavItem[] = [
  { label: "Home", href: "/", icon: "home" },
  { label: "Projects", href: "/projects", icon: "projects" },
  { label: "Log an expense", href: "/finance/claims/new", icon: "plus" },
  { label: "Approvals", href: "/approvals", icon: "approvals" },
  { label: "Me", href: "/profile", icon: "me" },
];

export const FINANCE_TABS: Tab[] = [
  { label: "Dashboard", href: "/finance" },
  { label: "Billing due", href: "/finance/billing" },
  { label: "Sent & due", href: "/finance/sent" },
  { label: "My claims", href: "/finance/claims" },
  { label: "Pending reimbursements", href: "/finance/reimbursements" },
  { label: "All transactions", href: "/finance/transactions" },
  { label: "GST and TDS", href: "/finance/tax" },
];

export const SETTINGS_TABS: Tab[] = [
  { label: "Company and letterhead", href: "/settings" },
  { label: "Rate card", href: "/settings/rate-card" },
];

export function projectFinanceTabs(id: string): Tab[] {
  const base = `/projects/${id}/finance`;
  return [
    { label: "Summary", href: base },
    { label: "Vendors & bills", href: `${base}/vendors` },
    { label: "Client payments", href: `${base}/payments` },
    { label: "Expenses", href: `${base}/expenses` },
  ];
}

export function boqTabs(id: string): Tab[] {
  const base = `/projects/${id}/boq`;
  return [
    { label: "Build BOQ", href: base },
    { label: "Client View", href: `${base}/client-view` },
    { label: "Client Review", href: `${base}/review` },
    { label: "Versions & Approvals", href: `${base}/versions` },
  ];
}

export function homeBudgetTabs(id: string): Tab[] {
  const base = `/projects/${id}/home-budget`;
  return [
    { label: "Plan vs actual", href: base },
    { label: "Client purchases", href: `${base}/purchases` },
  ];
}

export function milestoneTabs(id: string): Tab[] {
  const base = `/projects/${id}/milestones`;
  return [
    { label: "Gantt chart", href: base },
    { label: "Daily reports (DPR)", href: `${base}/dpr` },
    { label: "Progress by BOQ line", href: `${base}/progress` },
  ];
}

export function clientTabs(token: string): Tab[] {
  const base = `/c/${token}`;
  return [
    { label: "Progress", href: base },
    { label: "Budget", href: `${base}/budget` },
    { label: "Estimate", href: `${base}/estimate` },
    { label: "Payments", href: `${base}/payments` },
    { label: "Docs", href: `${base}/documents` },
    { label: "Snags", href: `${base}/snags` },
    { label: "Handover", href: `${base}/handover` },
  ];
}

/**
 * Whether a nav item is the current page. Exact match for section roots
 * ("/", "/projects/x"), prefix match for the rest so sub-pages stay highlighted.
 */
export function isActive(pathname: string, href: string, exact = false, matches: string[] = []): boolean {
  if ([href, ...matches].includes(pathname)) return true;
  if (exact || href === "/") return false;
  return [href, ...matches].some((h) => pathname.startsWith(`${h}/`));
}
