import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";

type RoleRelation =
  | { name?: string; key?: string }
  | { name?: string; key?: string }[]
  | null;

export default async function HrLayout({ children }: { children: React.ReactNode }) {
  if (!isSupabaseConfigured()) {
    return (
      <AppShell
        userName="Alex Morgan"
        userEmail="alex@company.com"
        userRole="Super administrator"
        demo
      >
        {children}
      </AppShell>
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: profile }, { data: assignments }, { data: lifecycle }, { data: canViewDashboard }] = await Promise.all([
    supabase
      .from("profiles")
      .select("full_name,job_title")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("user_roles")
      .select("roles(name,key)")
      .eq("user_id", user.id),
    supabase
      .from("employee_account_lifecycle")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase.rpc("has_permission", { permission_key: "dashboard.view" }),
  ]);
  if (lifecycle && !canViewDashboard) redirect("/employee/onboarding");
  const roles = (assignments ?? []).flatMap((assignment) => {
    const relation = assignment.roles as RoleRelation;
    return Array.isArray(relation) ? relation : relation ? [relation] : [];
  });
  const preferredRole = roles.find((role) => role.key === "super_admin") ?? roles[0];

  return (
    <AppShell
      userName={profile?.full_name || user.email?.split("@")[0] || "HR user"}
      userEmail={user.email || ""}
      userRole={preferredRole?.name || profile?.job_title || "Team member"}
    >
      {children}
    </AppShell>
  );
}
