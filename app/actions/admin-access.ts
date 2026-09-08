"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";

export type AdminAccessResult =
  | { ok: true; message: string }
  | { ok: false; message: string };

const input = z.object({
  userId: z.string().uuid(),
  roleId: z.union([z.string().uuid(), z.literal("")]),
});

const assignableRoleKeys = [
  "hr_admin",
  "hr_manager",
  "recruiter",
  "hiring_manager",
  "onboarding_specialist",
  "records_officer",
];

export async function setHrUserRole(
  raw: z.input<typeof input>,
): Promise<AdminAccessResult> {
  const parsed = input.safeParse(raw);
  if (!parsed.success) return { ok: false, message: "Select a valid HR role." };
  if (!isSupabaseConfigured() || !isAdminConfigured())
    return { ok: false, message: "Supabase administrator credentials are required." };

  const session = await createClient();
  const {
    data: { user },
  } = await session.auth.getUser();
  if (!user) return { ok: false, message: "Sign in again to manage access." };
  const [{ data: assurance }, { data: allowed }, { data: actorProfile }] =
    await Promise.all([
      session.auth.mfa.getAuthenticatorAssuranceLevel(),
      session.rpc("has_permission", { permission_key: "*" }),
      session
        .from("profiles")
        .select("organization_id")
        .eq("id", user.id)
        .maybeSingle(),
    ]);
  if (
    assurance?.currentLevel !== "aal2" ||
    !allowed ||
    !actorProfile?.organization_id
  )
    return { ok: false, message: "Super-administrator access with MFA is required." };

  const admin = createAdminClient();
  const { data: target } = await admin
    .from("profiles")
    .select("id,organization_id")
    .eq("id", parsed.data.userId)
    .eq("organization_id", actorProfile.organization_id)
    .maybeSingle();
  if (!target) return { ok: false, message: "The selected organization user was not found." };

  if (target.id === user.id)
    return {
      ok: false,
      message: "You cannot change your own super-administrator role.",
    };

  const { data: assignableRoles, error: rolesError } = await admin
    .from("roles")
    .select("id,key,name")
    .in("key", assignableRoleKeys);
  if (rolesError) return { ok: false, message: rolesError.message };
  const nextRole = parsed.data.roleId
    ? (assignableRoles || []).find((role) => role.id === parsed.data.roleId)
    : null;
  if (parsed.data.roleId && !nextRole)
    return { ok: false, message: "That role cannot be assigned from this screen." };

  const { data: assignedName, error: assignmentError } = await admin.rpc(
    "assign_hr_user_role",
    {
      target_user_uuid: target.id,
      selected_role_uuid: nextRole?.id || null,
      actor_user_uuid: user.id,
    },
  );
  if (assignmentError) return { ok: false, message: assignmentError.message };
  revalidatePath("/hr/settings");
  return {
    ok: true,
    message: nextRole
      ? `${String(assignedName || nextRole.name)} access assigned.`
      : "HR workspace access removed.",
  };
}
