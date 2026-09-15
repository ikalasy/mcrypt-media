import { NextResponse, type NextRequest } from "next/server";
import { requireAdminApi } from "@/lib/admin-guard";
import { setUserPassword } from "@/lib/users";

const PASSWORD_MIN = 8;

export async function PUT(request: NextRequest, context: RouteContext<"/api/admin/users/[id]/password">) {
  const { session, error } = await requireAdminApi();
  if (error) return error;
  const { id } = await context.params;
  let body: { password?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const password = typeof body.password === "string" ? body.password : "";
  if (password.length < PASSWORD_MIN) {
    return NextResponse.json({ error: `Password must be at least ${PASSWORD_MIN} characters.` }, { status: 400 });
  }
  try {
    await setUserPassword(session, id, password);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[admin/users] password reset failed:", err);
    return NextResponse.json({ error: "Could not set the password." }, { status: 502 });
  }
}
