import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { SettingsForm } from "@/components/SettingsForm";

export const metadata = { title: "Settings", robots: { index: false } };

export default async function Settings() {
  const u = await currentUser();
  if (!u) redirect("/login?next=/me/settings");
  return (
    <main className="max-w-[600px] mx-auto px-6 pt-14 pb-20">
      <h1 className="text-[42px] font-medium tracking-tight text-ink">Settings</h1>
      <p className="mt-2 text-sm text-muted">@{u.username}</p>
      <SettingsForm name={u.name} bio={u.bio} avatar={u.avatar} />
    </main>
  );
}
