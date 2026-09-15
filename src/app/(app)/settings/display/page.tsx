import { cookies } from "next/headers";
import { ThemePicker } from "@/components/ThemePicker";
import { requireMember } from "@/lib/session";
import { THEME_COOKIE, resolveTheme } from "@/lib/theme";

export const dynamic = "force-dynamic";
export const metadata = { title: "Display" };

export default async function DisplaySettingsPage() {
  await requireMember();
  const store = await cookies();
  const theme = resolveTheme(store.get(THEME_COOKIE)?.value);
  return (
    <div className="max-w-xl space-y-8">
      <div>
        <p className="label mb-1 text-text">Theme</p>
        <p className="label mb-5 text-[0.62rem] text-dim">Dark is the house style. Auto follows your device.</p>
        <ThemePicker current={theme} />
      </div>
    </div>
  );
}
