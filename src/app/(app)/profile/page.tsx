import { Placeholder } from "@/components/Placeholder";
import { screen } from "@/lib/screens";

export const metadata = { title: screen("profile").title };

export default function ProfilePage() {
  return <Placeholder screenKey="profile" />;
}
