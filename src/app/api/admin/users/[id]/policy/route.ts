import { NextResponse, type NextRequest } from "next/server";
import { requireAdminApi } from "@/lib/admin-guard";
import { POLICY_GROUPS, POLICY_READONLY_KEYS, getUser, setUserPolicy, type UserPolicy } from "@/lib/users";

const EDITABLE_KEYS = new Set(POLICY_GROUPS.flatMap((g) => g.fields.map((f) => f.key)));

/** Merge the submitted editable fields over Jellyfin's current policy, so nothing unknown is dropped. */
export async function PUT(request: NextRequest, context: RouteContext<"/api/admin/users/[id]/policy">) {
  const { session, error } = await requireAdminApi();
  if (error) return error;
  const { id } = await context.params;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  if (id === session.userId && body.IsAdministrator === false) {
    return NextResponse.json({ error: "You cannot remove your own admin role." }, { status: 400 });
  }
  if (id === session.userId && body.IsDisabled === true) {
    return NextResponse.json({ error: "You cannot disable the account you are signed in with." }, { status: 400 });
  }

  try {
    const current = (await getUser(session, id)).Policy ?? {};
    const merged: UserPolicy = { ...current };
    for (const [key, value] of Object.entries(body)) {
      if (EDITABLE_KEYS.has(key) && !POLICY_READONLY_KEYS.includes(key)) merged[key] = value;
    }
    await setUserPolicy(session, id, merged);
    return NextResponse.json({ policy: merged });
  } catch (err) {
    console.error("[admin/users] policy update failed:", err);
    return NextResponse.json({ error: "Jellyfin rejected the policy update." }, { status: 502 });
  }
}
