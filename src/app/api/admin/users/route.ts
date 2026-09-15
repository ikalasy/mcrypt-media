import { NextResponse, type NextRequest } from "next/server";
import { JellyfinError } from "@/lib/jellyfin";
import { requireAdminApi } from "@/lib/admin-guard";
import { createUser, listUsers } from "@/lib/users";

const NAME_MAX = 64;
const PASSWORD_MIN = 8;

export async function GET() {
  const { session, error } = await requireAdminApi();
  if (error) return error;
  try {
    const users = await listUsers(session);
    return NextResponse.json({ users }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("[admin/users] list failed:", err);
    return NextResponse.json({ error: "Could not load users." }, { status: 502 });
  }
}

export async function POST(request: NextRequest) {
  const { session, error } = await requireAdminApi();
  if (error) return error;
  let body: { name?: unknown; password?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!name || name.length > NAME_MAX || /[^\w.\- ]/.test(name)) {
    return NextResponse.json({ error: "Username: letters, numbers, dots, dashes, spaces; up to 64 characters." }, { status: 400 });
  }
  if (password.length < PASSWORD_MIN) {
    return NextResponse.json({ error: `Password must be at least ${PASSWORD_MIN} characters.` }, { status: 400 });
  }
  try {
    const user = await createUser(session, name, password);
    return NextResponse.json({ user }, { status: 201 });
  } catch (err) {
    if (err instanceof JellyfinError && err.status === 400) {
      return NextResponse.json({ error: "Jellyfin refused that username. It may already exist." }, { status: 400 });
    }
    console.error("[admin/users] create failed:", err);
    return NextResponse.json({ error: "Could not create the user." }, { status: 502 });
  }
}
