import { NextResponse, type NextRequest } from "next/server";
import { getEnv } from "@/lib/env";
import { authorizationHeader } from "@/lib/jellyfin";
import { getSession } from "@/lib/session";

const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

/** The real type from the file signature, so a mislabeled upload is refused. */
function sniffImageType(bytes: Uint8Array): string | null {
  if (bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length > 7 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image/png";
  const riff = bytes.length > 11 && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46;
  const webp = riff && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50;
  return webp ? "image/webp" : null;
}

/** Upload a profile picture into Jellyfin (it expects the image as base64 text). */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  if (session.isGuest) return NextResponse.json({ error: "Guests cannot change a picture." }, { status: 403 });

  const contentType = request.headers.get("content-type") ?? "";
  if (!ALLOWED_TYPES.has(contentType)) {
    return NextResponse.json({ error: "Use a JPG, PNG, or WEBP image." }, { status: 415 });
  }
  const bytes = await request.arrayBuffer();
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_BYTES) {
    return NextResponse.json({ error: "Image must be between 1 byte and 10 MB." }, { status: 413 });
  }
  if (sniffImageType(new Uint8Array(bytes)) !== contentType) {
    return NextResponse.json({ error: "That file is not a JPG, PNG, or WEBP image." }, { status: 415 });
  }

  const target = `${getEnv().jellyfinUrl}/UserImage?userId=${encodeURIComponent(session.userId)}`;
  const upstream = await fetch(target, {
    method: "POST",
    headers: {
      Authorization: authorizationHeader(session.token, session.deviceId),
      "Content-Type": contentType,
    },
    body: Buffer.from(bytes).toString("base64"),
    cache: "no-store",
  });
  if (!upstream.ok) {
    console.error(`[profile/avatar] Jellyfin rejected upload: ${upstream.status}`);
    return NextResponse.json({ error: "The media server rejected the image." }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  if (session.isGuest) return NextResponse.json({ error: "Guests cannot change a picture." }, { status: 403 });
  const target = `${getEnv().jellyfinUrl}/UserImage?userId=${encodeURIComponent(session.userId)}`;
  const upstream = await fetch(target, {
    method: "DELETE",
    headers: { Authorization: authorizationHeader(session.token, session.deviceId) },
    cache: "no-store",
  });
  if (!upstream.ok && upstream.status !== 404) {
    return NextResponse.json({ error: "Could not remove the picture." }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}
