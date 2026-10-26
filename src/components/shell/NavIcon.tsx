import {
  BadgeCheck,
  Banknote,
  CircleUser,
  ClipboardCheck,
  FileText,
  Filter,
  Folder,
  House,
  LayoutGrid,
  LineChart,
  NotebookText,
  PieChart,
  Plus,
  Settings,
  TriangleAlert,
  Users,
  type LucideIcon,
} from "lucide-react";

import type { NavIcon as NavIconName } from "@/lib/nav";

const ICONS: Record<NavIconName, LucideIcon> = {
  home: House,
  insights: LineChart,
  leads: Filter,
  projects: Folder,
  finance: Banknote,
  team: Users,
  settings: Settings,
  overview: LayoutGrid,
  files: FileText,
  boq: NotebookText,
  budget: PieChart,
  milestones: ClipboardCheck,
  snags: TriangleAlert,
  approvals: BadgeCheck,
  plus: Plus,
  me: CircleUser,
};

/** Lucide outline icons, 20 px in navigation with a 1.75 stroke (UI spec 9). */
export function NavIcon({ name }: { name: NavIconName }) {
  const Icon = ICONS[name];
  return <Icon aria-hidden size={20} strokeWidth={1.75} />;
}
