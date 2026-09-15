import { ProfileForm } from "@/components/ProfileForm";
import { getMe } from "@/lib/jellyfin";
import { getProfile } from "@/lib/profile";
import { requireMember } from "@/lib/session";

export const dynamic = "force-dynamic";
export const metadata = { title: "Profile" };

export default async function ProfileSettingsPage() {
  const session = await requireMember();
  const [profile, me] = await Promise.all([
    Promise.resolve(getProfile(session.userId)),
    getMe(session).catch(() => null),
  ]);
  const avatar = me?.PrimaryImageTag
    ? `/api/jf/UserImage?userId=${session.userId}&tag=${me.PrimaryImageTag}&fillWidth=240&fillHeight=240&quality=90`
    : null;
  return (
    <ProfileForm
      userId={session.userId}
      userName={session.userName}
      displayName={profile.displayName ?? ""}
      bio={profile.bio ?? ""}
      avatarUrl={avatar}
      imageTag={me?.PrimaryImageTag ?? null}
    />
  );
}
