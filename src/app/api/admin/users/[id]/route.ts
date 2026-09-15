import { NextResponse, type NextRequest } from "next/server";
import { requireAdminApi } from "@/lib/admin-guard";
import { deleteUser, getUser } from "@/lib/users";

export async function GET(_request: NextRequest, context: RouteContext<"/api/admin/users/[id]">) {
  const { session, error } = await requireAdminApi();
  if (error) return error;
  const { id } = await context.params;
  try {
    const user = await getUser(session, id);
    return NextResponse.json({ user }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("[admin/users] get failed:", err);
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext<"/api/admin/users/[id]">) {
  const { session, error } = await requireAdminApi();
  if (error) return error;
  const { id } = await context.params;
  if (id === session.userId) {
    return NextResponse.json({ error: "You cannot delete the account you are signed in with." }, { status: 400 });
  }
  try {
    await deleteUser(session, id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[admin/users] delete failed:", err);
    return NextResponse.json({ error: "Could not delete the user." }, { status: 502 });
  }
}
