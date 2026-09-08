import "server-only";

import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";

export type AdminAccessData = {
  canManage: boolean;
  currentUserId: string | null;
  users: Array<{
    id: string;
    fullName: string;
    email: string;
    status: string;
    roleId: string | null;
    roleKey: string | null;
    roleName: string;
  }>;
  roles: Array<{ id: string; key: string; name: string }>;
};

type Relation = { id?: string; key?: string; name?: string } | null;

export async function getAdminAccessData(): Promise<AdminAccessData> {
  const empty: AdminAccessData = {
    canManage: false,
    currentUserId: null,
    users: [],
    roles: [],
  };
  if (!isSupabaseConfigured() || !isAdminConfigured()) return empty;

  const session = await createClient();
  const {
    data: { user },
  } = await session.auth.getUser();
  if (!user) return empty;
  const [{ data: canManage }, { data: profile }] = await Promise.all([
    session.rpc("has_permission", { permission_key: "*" }),
    session
      .from("profiles")
      .select("organization_id")
      .eq("id", user.id)
      .maybeSingle(),
  ]);
  if (!canManage || !profile?.organization_id)
    return { ...empty, currentUserId: user.id };

  const admin = createAdminClient();
  const allowedKeys = [
    "hr_admin",
    "hr_manager",
    "recruiter",
    "hiring_manager",
    "onboarding_specialist",
    "records_officer",
  ];
  const [profilesResult, rolesResult, assignmentsResult, lifecycleResult, authResult] =
    await Promise.all([
      admin
        .from("profiles")
        .select("id,full_name,status")
        .eq("organization_id", profile.organization_id)
        .order("created_at"),
      admin.from("roles").select("id,key,name").in("key", allowedKeys).order("name"),
      admin.from("user_roles").select("user_id,role_id,roles(id,key,name)"),
      admin.from("employee_account_lifecycle").select("user_id"),
      admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    ]);

  const firstError = [profilesResult, rolesResult, assignmentsResult, lifecycleResult].find(
    (result) => result.error,
  )?.error;
  if (firstError || authResult.error)
    throw new Error(firstError?.message || authResult.error?.message || "Access data could not be loaded.");

  const employeeUserIds = new Set(
    (lifecycleResult.data || []).map((item) => String(item.user_id)),
  );
  const emailById = new Map(
    authResult.data.users.map((authUser) => [authUser.id, authUser.email || "No email"]),
  );
  const assignments = assignmentsResult.data || [];
  const profiles = (profilesResult.data || []).filter(
    (item) => !employeeUserIds.has(String(item.id)),
  );

  return {
    canManage: true,
    currentUserId: user.id,
    roles: (rolesResult.data || []).map((role) => ({
      id: String(role.id),
      key: String(role.key),
      name: String(role.name),
    })),
    users: profiles.map((item) => {
      const userAssignments = assignments.filter(
        (assignment) => assignment.user_id === item.id,
      );
      const superAssignment = userAssignments.find(
        (assignment) => (assignment.roles as Relation)?.key === "super_admin",
      );
      const hrAssignment = userAssignments.find((assignment) =>
        allowedKeys.includes(String((assignment.roles as Relation)?.key || "")),
      );
      const selected = superAssignment || hrAssignment;
      const relation = selected?.roles as Relation;
      return {
        id: String(item.id),
        fullName: item.full_name || "Unnamed user",
        email: emailById.get(String(item.id)) || "No email",
        status: String(item.status),
        roleId: selected ? String(selected.role_id) : null,
        roleKey: relation?.key ? String(relation.key) : null,
        roleName: relation?.name ? String(relation.name) : "No HR access",
      };
    }),
  };
}

