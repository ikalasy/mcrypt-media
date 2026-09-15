import { UsersAdmin } from "@/components/UsersAdmin";
import { GUEST_USERNAME } from "@/lib/guest";
import { getProfiles } from "@/lib/profile";
import { requireAdmin } from "@/lib/session";
import { listUsers } from "@/lib/users";

export const dynamic = "force-dynamic";
export const metadata = { title: "Users" };

export default async function UsersSettingsPage() {
  const session = await requireAdmin();
  const users = await listUsers(session).catch(() => []);
  const profiles = getProfiles(users.map((u) => u.Id));
  const rows = users.map((u) => ({
    id: u.Id,
    name: u.Name,
    displayName: profiles.get(u.Id)?.displayName ?? null,
    isAdmin: Boolean(u.Policy?.IsAdministrator),
    isDisabled: Boolean(u.Policy?.IsDisabled),
    isGuest: u.Name.toLowerCase() === GUEST_USERNAME,
    lastActivity: u.LastActivityDate ?? u.LastLoginDate ?? null,
    imageTag: u.PrimaryImageTag ?? null,
  }));
  return <UsersAdmin users={rows} selfId={session.userId} />;
}
