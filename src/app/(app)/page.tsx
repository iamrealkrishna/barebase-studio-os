import { Placeholder } from "@/components/Placeholder";
import { screen } from "@/lib/screens";

export const metadata = { title: screen("home").title };

export default function HomePage() {
  return <Placeholder screenKey="home" workingToday={[{ label: "Projects", href: "/projects" }, { label: "Rate card", href: "/settings/rate-card" }, { label: "Your account", href: "/account" }]} />;
}
