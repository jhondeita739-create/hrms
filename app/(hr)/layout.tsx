import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";

export default async function HrLayout({ children }: { children: React.ReactNode }) {
  const configured = isSupabaseConfigured();
  if (!configured) return <AppShell userName="Alex Morgan" userEmail="HR administrator · Preview" demo>{children}</AppShell>;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("full_name, job_title").eq("id", user.id).maybeSingle();
  return <AppShell userName={profile?.full_name || user.email?.split("@")[0] || "HR user"} userEmail={profile?.job_title || user.email || ""}>{children}</AppShell>;
}
