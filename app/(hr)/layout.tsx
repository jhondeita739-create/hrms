import { redirect } from "next/navigation";
import { ShieldAlert } from "lucide-react";
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
  const hasHrRole = roles.some(
    (role) => role.key && !["employee", "preboarding_employee"].includes(role.key),
  );

  if (!hasHrRole)
    return (
      <AppShell
        userName={profile?.full_name || user.email?.split("@")[0] || "User"}
        userEmail={user.email || ""}
        userRole="Access pending"
      >
        <section className="mx-auto max-w-xl rounded-3xl border border-amber-200 bg-white p-8 text-center shadow-sm">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-amber-50 text-amber-600">
            <ShieldAlert className="h-7 w-7" />
          </span>
          <h1 className="mt-5 text-2xl font-extrabold text-slate-900">HR access has not been assigned</h1>
          <p className="mt-3 text-sm leading-6 text-slate-500">
            Your account is authenticated, but it does not have an HR role. Ask the super administrator to assign access under Settings → Roles &amp; permissions.
          </p>
        </section>
      </AppShell>
    );

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
