import Link from "next/link";
import { notFound } from "next/navigation";
import { PolicyEditor } from "@/components/PolicyEditor";
import { GUEST_USERNAME } from "@/lib/guest";
import { requireAdmin } from "@/lib/session";
import { POLICY_GROUPS, getUser, listVirtualFolders } from "@/lib/users";

export const dynamic = "force-dynamic";

export default async function UserEditPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin();
  const { id } = await params;
  const [user, folders] = await Promise.all([
    getUser(session, id).catch(() => null),
    listVirtualFolders(session).catch(() => []),
  ]);
  if (!user) notFound();
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href="/settings/users" className="label text-dim hover:text-text">&larr; Users</Link>
          <p className="mt-2 text-xl uppercase tracking-[0.12em]">{user.Name}</p>
          {user.Name.toLowerCase() === GUEST_USERNAME && (
            <p className="label mt-1 text-[0.62rem] text-warn">
              Shared public account. Re-provisioning from the Server page resets this policy.
            </p>
          )}
        </div>
        <p className="label text-[0.62rem] text-dim">
          {user.Policy?.IsAdministrator ? "Administrator" : "Member"} &middot; last seen{" "}
          {user.LastActivityDate ? new Date(user.LastActivityDate).toLocaleString("en-US") : "never"}
        </p>
      </div>
      <PolicyEditor
        userId={user.Id}
        isSelf={user.Id === session.userId}
        policy={user.Policy ?? {}}
        groups={POLICY_GROUPS}
        folders={folders.map((f) => ({ id: f.ItemId, name: f.Name }))}
      />
    </div>
  );
}
