import { NextResponse } from "next/server";
import { formatRuntime } from "@/lib/format";
import { backdropImage } from "@/lib/images";
import { jf } from "@/lib/jellyfin";
import { getSession } from "@/lib/session";
import type { ItemsResult } from "@/lib/types";

const POOL_SIZE = 24;

export type ScreensaverItem = { id: string; name: string; meta: string; backdrop: string };

/** A random set of titles with backdrops for the idle screen. */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  try {
    const result = await jf<ItemsResult>("Items", {
      token: session.token,
      deviceId: session.deviceId,
      query: {
        userId: session.userId,
        recursive: true,
        includeItemTypes: "Movie,Series",
        sortBy: "Random",
        limit: POOL_SIZE * 2,
        fields: "Genres,ProductionYear,RunTimeTicks,ChildCount",
        imageTypes: "Backdrop",
        enableImageTypes: "Backdrop",
        imageTypeLimit: 1,
        enableUserData: false,
      },
    });
    const items: ScreensaverItem[] = result.Items.flatMap((item) => {
      const backdrop = backdropImage(item, 1920);
      if (!backdrop || !item.BackdropImageTags?.length) return [];
      const meta = [
        item.ProductionYear ? String(item.ProductionYear) : "",
        item.Genres?.[0] ?? "",
        item.Type === "Series"
          ? item.ChildCount
            ? `${item.ChildCount} SEASON${item.ChildCount === 1 ? "" : "S"}`
            : "SERIES"
          : formatRuntime(item.RunTimeTicks),
      ]
        .filter(Boolean)
        .join("  /  ");
      return [{ id: item.Id, name: item.Name, meta, backdrop }];
    });
    return NextResponse.json({ items: items.slice(0, POOL_SIZE) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[screensaver] failed:", error);
    return NextResponse.json({ items: [] }, { status: 502 });
  }
}
