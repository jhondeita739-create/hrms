"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createApplicantNotification } from "@/lib/applicant-notifications";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";

export type PreboardingMutationResult =
  | { ok: true; message: string; id?: string; url?: string }
  | { ok: false; message: string };

async function hrContext() {
  if (!isSupabaseConfigured() || !isAdminConfigured()) return null;
  const session = await createClient();
  const {
    data: { user },
  } = await session.auth.getUser();
  if (!user) return null;
  const { data: assurance } =
    await session.auth.mfa.getAuthenticatorAssuranceLevel();
  if (assurance?.currentLevel !== "aal2") return null;
  const [{ data: allowed }, { data: profile }] = await Promise.all([
    session.rpc("has_permission", { permission_key: "onboarding.manage" }),
    session.from("profiles").select("organization_id").eq("id", user.id).maybeSingle(),
  ]);
  if (!allowed || !profile?.organization_id) return null;
  return {
    session,
    admin: createAdminClient(),
    user,
    organizationId: String(profile.organization_id),
  };
}

function refreshPreboarding() {
  revalidatePath("/hr/preboarding");
  revalidatePath("/hr/onboarding");
  revalidatePath("/hr/employees");
  revalidatePath("/hr/dashboard");
  revalidatePath("/employee/onboarding");
}

const startSchema = z
  .object({
    applicationId: z.string().uuid(),
    startDate: z.string().date(),
    requirementsDueDate: z.string().date(),
    trainingStart: z.string().min(1),
    trainingEnd: z.string().min(1),
    timezone: z.string().trim().min(1).max(80),
    location: z.string().trim().max(300).optional(),
    meetingUrl: z.union([z.url(), z.literal("")]).optional(),
  })
  .refine((value) => value.requirementsDueDate >= new Date().toISOString().slice(0, 10), {
    message: "The requirements deadline cannot be in the past.",
  })
  .refine((value) => new Date(value.trainingEnd) > new Date(value.trainingStart), {
    message: "Training must end after it starts.",
  })
  .refine(
    (value) => new Date(value.trainingStart) > new Date(`${value.requirementsDueDate}T23:59:59`),
    { message: "Training must be scheduled after the requirements deadline." },
  );

async function findUserByEmail(
  admin: ReturnType<typeof createAdminClient>,
  email: string,
) {
  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 100 });
    if (error) throw error;
    const found = data.users.find(
      (candidate) => candidate.email?.toLowerCase() === email.toLowerCase(),
    );
    if (found) return found;
    if (data.users.length < 100) break;
  }
  return null;
}

type ApplicantIdentity = {
  first_name?: string;
  middle_name?: string;
  last_name?: string;
  email?: string;
};

async function provisionEmployeeAuthUser(
  admin: ReturnType<typeof createAdminClient>,
  organizationId: string,
  applicant: ApplicantIdentity,
) {
  if (!applicant.email)
    return { userId: null, invitedUserId: null, error: "The applicant must have a valid email address." };

  const existingUser = await findUserByEmail(admin, applicant.email);
  if (existingUser) {
    const { data: existingRoles } = await admin
      .from("user_roles")
      .select("roles(key)")
      .eq("user_id", existingUser.id);
    const roleKeys = (existingRoles || []).flatMap((row) => {
      const relation = row.roles as unknown as { key?: string } | { key?: string }[] | null;
      return (Array.isArray(relation) ? relation : relation ? [relation] : [])
        .map((role) => role.key)
        .filter(Boolean);
    });
    if (roleKeys.some((key) => !["employee", "preboarding_employee"].includes(String(key))))
      return {
        userId: null,
        invitedUserId: null,
        error: "That email already belongs to an HR account and cannot be converted.",
      };
    return { userId: existingUser.id, invitedUserId: null, error: null };
  }

  const fullName = [applicant.first_name, applicant.middle_name, applicant.last_name]
    .filter(Boolean)
    .join(" ");
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");
  const { data, error } = await admin.auth.admin.inviteUserByEmail(applicant.email, {
    data: {
      full_name: fullName,
      organization_id: organizationId,
      account_type: "temporary_employee",
    },
    redirectTo: `${siteUrl}/auth/callback?next=/account/set-password`,
  });
  if (error || !data.user)
    return {
      userId: null,
      invitedUserId: null,
      error: error?.message || "The temporary account invitation failed.",
    };
  return { userId: data.user.id, invitedUserId: data.user.id, error: null };
}

export async function startEmployeePreboarding(
  raw: z.input<typeof startSchema>,
): Promise<PreboardingMutationResult> {
  const parsed = startSchema.safeParse(raw);
  if (!parsed.success)
    return { ok: false, message: parsed.error.issues[0]?.message || "Check the setup details." };
  const ctx = await hrContext();
  if (!ctx)
    return {
      ok: false,
      message: "Administrator credentials and onboarding permission are required.",
    };

  const { data: application } = await ctx.admin
    .from("job_applications")
    .select("id,application_status,applicants(first_name,middle_name,last_name,email),job_vacancies(title)")
    .eq("id", parsed.data.applicationId)
    .eq("organization_id", ctx.organizationId)
    .maybeSingle();
  if (!application || application.application_status !== "hired")
    return { ok: false, message: "Select a hired application that has not started onboarding." };

  const applicant = application.applicants as unknown as ApplicantIdentity | null;
  const vacancy = application.job_vacancies as unknown as { title?: string } | null;
  if (!applicant?.email)
    return { ok: false, message: "The applicant must have a valid email address." };

  const provisioned = await provisionEmployeeAuthUser(
    ctx.admin,
    ctx.organizationId,
    applicant,
  );
  if (!provisioned.userId)
    return { ok: false, message: provisioned.error || "The temporary account could not be created." };

  const { data: lifecycleId, error: setupError } = await ctx.admin.rpc(
    "initialize_employee_preboarding",
    {
      application_uuid: parsed.data.applicationId,
      employee_user_uuid: provisioned.userId,
      start_on: parsed.data.startDate,
      requirements_due_on: parsed.data.requirementsDueDate,
      training_starts_at: new Date(parsed.data.trainingStart).toISOString(),
      training_ends_at: new Date(parsed.data.trainingEnd).toISOString(),
      training_timezone: parsed.data.timezone,
      training_location: parsed.data.location || "",
      training_meeting_url: parsed.data.meetingUrl || "",
      creator_uuid: ctx.user.id,
    },
  );

  if (setupError) {
    if (provisioned.invitedUserId)
      await ctx.admin.auth.admin.deleteUser(provisioned.invitedUserId);
    return { ok: false, message: setupError.message };
  }

  refreshPreboarding();
  return {
    ok: true,
    id: String(lifecycleId),
    message: provisioned.invitedUserId
      ? `Temporary account created and invitation sent to ${applicant.email}.`
      : `Existing account linked to ${vacancy?.title || "the hired position"}.`,
  };
}

const hireAndStartSchema = z.intersection(
  startSchema,
  z.object({
    hiredStageId: z.string().uuid(),
    decisionReason: z.string().trim().max(1000).optional(),
  }),
);

export async function hireAndStartEmployeePreboarding(
  raw: z.input<typeof hireAndStartSchema>,
): Promise<PreboardingMutationResult> {
  const parsed = hireAndStartSchema.safeParse(raw);
  if (!parsed.success)
    return {
      ok: false,
      message: parsed.error.issues[0]?.message || "Check the hiring and onboarding details.",
    };
  const ctx = await hrContext();
  if (!ctx)
    return {
      ok: false,
      message: "Administrator credentials and onboarding permission are required.",
    };

  const [{ data: application }, { data: hiredStage }] = await Promise.all([
    ctx.admin
      .from("job_applications")
      .select(
        "id,applicant_id,application_status,profile_completion_status,applicants(first_name,middle_name,last_name,email),job_vacancies(title),interviews(status,interview_evaluations(id))",
      )
      .eq("id", parsed.data.applicationId)
      .eq("organization_id", ctx.organizationId)
      .maybeSingle(),
    ctx.admin
      .from("recruitment_stages")
      .select("id,name,stage_type")
      .eq("id", parsed.data.hiredStageId)
      .eq("organization_id", ctx.organizationId)
      .eq("stage_type", "hired")
      .eq("is_active", true)
      .maybeSingle(),
  ]);
  if (!application || !hiredStage)
    return { ok: false, message: "The application or hired stage is unavailable." };
  if (application.application_status === "hired")
    return {
      ok: false,
      message: "This applicant is already hired. Use Employee preboarding to create or recover their account.",
    };
  if (application.profile_completion_status !== "completed")
    return {
      ok: false,
      message: "The applicant must complete their screened profile before they can be hired.",
    };

  const { data: verifiedResume } = await ctx.admin
    .from("applicant_documents")
    .select("id")
    .eq("job_application_id", application.id)
    .eq("document_type", "resume")
    .eq("verification_status", "verified")
    .is("deleted_at", null)
    .limit(1)
    .maybeSingle();
  if (!verifiedResume)
    return { ok: false, message: "Verify the applicant's resume before hiring." };

  const interviews = application.interviews as unknown as Array<{
    status?: string;
    interview_evaluations?: Array<{ id?: string }>;
  }> | null;
  if (
    !interviews?.some(
      (interview) =>
        interview.status === "completed" &&
        Boolean(interview.interview_evaluations?.length),
    )
  )
    return {
      ok: false,
      message: "Complete and evaluate an interview before hiring this applicant.",
    };

  const applicant = application.applicants as unknown as ApplicantIdentity | null;
  const vacancy = application.job_vacancies as unknown as { title?: string } | null;
  if (!applicant?.email)
    return { ok: false, message: "The applicant must have a valid email address." };

  const provisioned = await provisionEmployeeAuthUser(
    ctx.admin,
    ctx.organizationId,
    applicant,
  );
  if (!provisioned.userId)
    return { ok: false, message: provisioned.error || "The temporary account could not be created." };

  const { data: lifecycleId, error: setupError } = await ctx.admin.rpc(
    "hire_and_initialize_employee_preboarding",
    {
      application_uuid: parsed.data.applicationId,
      hired_stage_uuid: parsed.data.hiredStageId,
      decision_reason: parsed.data.decisionReason || "",
      employee_user_uuid: provisioned.userId,
      start_on: parsed.data.startDate,
      requirements_due_on: parsed.data.requirementsDueDate,
      training_starts_at: new Date(parsed.data.trainingStart).toISOString(),
      training_ends_at: new Date(parsed.data.trainingEnd).toISOString(),
      training_timezone: parsed.data.timezone,
      training_location: parsed.data.location || "",
      training_meeting_url: parsed.data.meetingUrl || "",
      creator_uuid: ctx.user.id,
    },
  );
  if (setupError) {
    if (provisioned.invitedUserId)
      await ctx.admin.auth.admin.deleteUser(provisioned.invitedUserId);
    return { ok: false, message: setupError.message };
  }

  let notificationWarning = "";
  try {
    await createApplicantNotification(
      { db: ctx.admin, user: ctx.user, organizationId: ctx.organizationId },
      {
        applicantId: application.applicant_id,
        applicationId: application.id,
        recipient: applicant.email,
        eventType: "hired",
        subject: `Application decision: ${vacancy?.title || "your application"}`,
        body: `Hi ${applicant.first_name || "there"}, congratulations. You have been selected for ${vacancy?.title || "the position"}. A temporary employee account has been created so you can submit your employment requirements. Check your email for the secure activation link.`,
      },
    );
  } catch {
    notificationWarning = " The account was created, but the applicant notification could not be queued.";
  }

  refreshPreboarding();
  revalidatePath("/hr/recruitment/applicants");
  revalidatePath(`/hr/recruitment/applicants/${application.applicant_id}`);
  return {
    ok: true,
    id: String(lifecycleId),
    message: `Applicant hired, temporary account created, and preboarding started.${notificationWarning}`,
  };
}

const requirementSchema = z.object({
  lifecycleId: z.string().uuid(),
  title: z.string().trim().min(2).max(160),
  description: z.string().trim().max(1000).optional(),
  dueDate: z.string().date(),
  documentTypeId: z.union([z.string().uuid(), z.literal("")]).optional(),
  required: z.boolean().default(true),
});

export async function createEmployeeRequirement(
  raw: z.input<typeof requirementSchema>,
): Promise<PreboardingMutationResult> {
  const parsed = requirementSchema.safeParse(raw);
  const ctx = await hrContext();
  if (!ctx || !parsed.success)
    return { ok: false, message: parsed.success ? "Not authorized." : parsed.error.issues[0]?.message || "Check the requirement." };
  const { data: lifecycle } = await ctx.admin
    .from("employee_account_lifecycle")
    .select("employee_id,organization_id,access_status,employees(employee_onboarding(id))")
    .eq("id", parsed.data.lifecycleId)
    .eq("organization_id", ctx.organizationId)
    .maybeSingle();
  if (!lifecycle) return { ok: false, message: "Preboarding account not found." };
  const employee = lifecycle.employees as unknown as { employee_onboarding?: { id: string }[] };
  const { data, error } = await ctx.admin
    .from("employee_requirement_requests")
    .insert({
      organization_id: ctx.organizationId,
      employee_id: lifecycle.employee_id,
      onboarding_id: employee.employee_onboarding?.[0]?.id || null,
      document_type_id: parsed.data.documentTypeId || null,
      title: parsed.data.title,
      description: parsed.data.description || null,
      due_date: parsed.data.dueDate,
      required: parsed.data.required,
      created_by: ctx.user.id,
    })
    .select("id")
    .single();
  if (error) return { ok: false, message: error.message };
  refreshPreboarding();
  return { ok: true, id: data.id, message: "Requirement added." };
}

const updateRequirementSchema = requirementSchema.omit({ lifecycleId: true });

export async function updateEmployeeRequirement(
  requirementId: string,
  raw: z.input<typeof updateRequirementSchema>,
): Promise<PreboardingMutationResult> {
  const parsed = updateRequirementSchema.safeParse(raw);
  const ctx = await hrContext();
  if (!ctx || !z.string().uuid().safeParse(requirementId).success || !parsed.success)
    return { ok: false, message: "Check the requirement details." };
  const { data: requirement, error } = await ctx.admin
    .from("employee_requirement_requests")
    .update({
      title: parsed.data.title,
      description: parsed.data.description || null,
      due_date: parsed.data.dueDate,
      document_type_id: parsed.data.documentTypeId || null,
      required: parsed.data.required,
    })
    .eq("id", requirementId)
    .eq("organization_id", ctx.organizationId)
    .is("deleted_at", null)
    .select("employee_id")
    .maybeSingle();
  if (error || !requirement) return { ok: false, message: error?.message || "Requirement not found." };
  const { data: lifecycle } = await ctx.admin
    .from("employee_account_lifecycle")
    .select("id")
    .eq("employee_id", requirement.employee_id)
    .maybeSingle();
  if (lifecycle) await unlockPermanentAccess(ctx.admin, lifecycle.id, ctx.user.id);
  refreshPreboarding();
  return { ok: true, message: "Requirement updated." };
}

export async function reviewEmployeeRequirement(
  requirementId: string,
  status: "under_review" | "verified" | "rejected" | "waived",
  notes: string,
): Promise<PreboardingMutationResult> {
  const ctx = await hrContext();
  if (!ctx || !z.string().uuid().safeParse(requirementId).success)
    return { ok: false, message: "Requirement could not be reviewed." };
  const { data: requirement, error } = await ctx.admin
    .from("employee_requirement_requests")
    .update({
      status,
      reviewed_at: new Date().toISOString(),
      reviewed_by: ctx.user.id,
      review_notes: notes.trim() || null,
    })
    .eq("id", requirementId)
    .eq("organization_id", ctx.organizationId)
    .is("deleted_at", null)
    .select("employee_id")
    .maybeSingle();
  if (error || !requirement) return { ok: false, message: error?.message || "Requirement not found." };
  const { data: lifecycle } = await ctx.admin
    .from("employee_account_lifecycle")
    .select("id")
    .eq("employee_id", requirement.employee_id)
    .maybeSingle();
  if (lifecycle) await unlockPermanentAccess(ctx.admin, lifecycle.id, ctx.user.id);
  refreshPreboarding();
  return { ok: true, message: `Requirement marked ${status.replaceAll("_", " ")}.` };
}

export async function archiveEmployeeRequirement(
  requirementId: string,
): Promise<PreboardingMutationResult> {
  const ctx = await hrContext();
  if (!ctx || !z.string().uuid().safeParse(requirementId).success)
    return { ok: false, message: "Requirement could not be archived." };
  const { error } = await ctx.admin
    .from("employee_requirement_requests")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", requirementId)
    .eq("organization_id", ctx.organizationId);
  if (error) return { ok: false, message: error.message };
  refreshPreboarding();
  return { ok: true, message: "Requirement archived; its audit history is retained." };
}

export async function updateRequirementsDeadline(
  lifecycleId: string,
  dueDate: string,
): Promise<PreboardingMutationResult> {
  const ctx = await hrContext();
  if (!ctx || !z.string().uuid().safeParse(lifecycleId).success || !z.string().date().safeParse(dueDate).success)
    return { ok: false, message: "Select a valid deadline." };
  const { data: lifecycle, error } = await ctx.admin
    .from("employee_account_lifecycle")
    .update({ requirements_due_date: dueDate })
    .eq("id", lifecycleId)
    .eq("organization_id", ctx.organizationId)
    .select("employee_id")
    .maybeSingle();
  if (error || !lifecycle) return { ok: false, message: error?.message || "Account not found." };
  await ctx.admin
    .from("employee_requirement_requests")
    .update({ due_date: dueDate })
    .eq("employee_id", lifecycle.employee_id)
    .in("status", ["pending", "submitted", "under_review", "rejected"])
    .is("deleted_at", null);
  await unlockPermanentAccess(ctx.admin, lifecycleId, ctx.user.id);
  refreshPreboarding();
  return { ok: true, message: "Requirements deadline updated." };
}

export async function setEmployeeAccessStatus(
  lifecycleId: string,
  status: "temporary" | "suspended",
): Promise<PreboardingMutationResult> {
  const ctx = await hrContext();
  if (!ctx || !z.string().uuid().safeParse(lifecycleId).success)
    return { ok: false, message: "Account could not be updated." };
  const { data: lifecycle, error } = await ctx.admin
    .from("employee_account_lifecycle")
    .update({
      access_status: status,
      suspended_at: status === "suspended" ? new Date().toISOString() : null,
    })
    .eq("id", lifecycleId)
    .eq("organization_id", ctx.organizationId)
    .select("user_id")
    .maybeSingle();
  if (error || !lifecycle) return { ok: false, message: error?.message || "Account not found." };
  await ctx.admin
    .from("profiles")
    .update({ status: status === "suspended" ? "suspended" : "active" })
    .eq("id", lifecycle.user_id);
  refreshPreboarding();
  return { ok: true, message: status === "suspended" ? "Temporary access suspended." : "Temporary access restored." };
}

const trainingSchema = z
  .object({
    lifecycleId: z.string().uuid(),
    title: z.string().trim().min(2).max(160),
    description: z.string().trim().max(1000).optional(),
    trainingType: z.string().trim().min(2).max(80),
    scheduledStart: z.string().min(1),
    scheduledEnd: z.string().min(1),
    timezone: z.string().trim().min(1).max(80),
    location: z.string().trim().max(300).optional(),
    meetingUrl: z.union([z.url(), z.literal("")]).optional(),
  })
  .refine((value) => new Date(value.scheduledEnd) > new Date(value.scheduledStart), {
    message: "Training must end after it starts.",
  });

export async function createEmployeeTraining(
  raw: z.input<typeof trainingSchema>,
): Promise<PreboardingMutationResult> {
  const parsed = trainingSchema.safeParse(raw);
  const ctx = await hrContext();
  if (!ctx || !parsed.success)
    return { ok: false, message: parsed.success ? "Not authorized." : parsed.error.issues[0]?.message || "Check the schedule." };
  const { data: lifecycle } = await ctx.admin
    .from("employee_account_lifecycle")
    .select("employee_id,organization_id,access_status,employees(employee_onboarding(id))")
    .eq("id", parsed.data.lifecycleId)
    .eq("organization_id", ctx.organizationId)
    .maybeSingle();
  if (!lifecycle) return { ok: false, message: "Preboarding account not found." };
  const employee = lifecycle.employees as unknown as { employee_onboarding?: { id: string }[] };
  const { data, error } = await ctx.admin
    .from("employee_training_schedules")
    .insert({
      organization_id: ctx.organizationId,
      employee_id: lifecycle.employee_id,
      onboarding_id: employee.employee_onboarding?.[0]?.id || null,
      title: parsed.data.title,
      description: parsed.data.description || null,
      training_type: parsed.data.trainingType,
      scheduled_start: new Date(parsed.data.scheduledStart).toISOString(),
      scheduled_end: new Date(parsed.data.scheduledEnd).toISOString(),
      timezone: parsed.data.timezone,
      location: parsed.data.location || null,
      meeting_url: parsed.data.meetingUrl || null,
      status: lifecycle.access_status === "permanent" ? "scheduled" : "pending_requirements",
      created_by: ctx.user.id,
    })
    .select("id")
    .single();
  if (error) return { ok: false, message: error.message };
  await unlockPermanentAccess(ctx.admin, parsed.data.lifecycleId, ctx.user.id);
  refreshPreboarding();
  return { ok: true, id: data.id, message: "Training schedule added." };
}

export async function updateEmployeeTraining(
  trainingId: string,
  raw: Omit<z.input<typeof trainingSchema>, "lifecycleId"> & {
    status: "pending_requirements" | "scheduled" | "completed" | "cancelled";
  },
): Promise<PreboardingMutationResult> {
  const parsed = trainingSchema.omit({ lifecycleId: true }).safeParse(raw);
  const statusParsed = z.enum(["pending_requirements", "scheduled", "completed", "cancelled"]).safeParse(raw.status);
  const ctx = await hrContext();
  if (!ctx || !parsed.success || !statusParsed.success || !z.string().uuid().safeParse(trainingId).success)
    return { ok: false, message: parsed.success ? "Invalid training schedule." : parsed.error.issues[0]?.message || "Check the schedule." };
  const { data: training, error } = await ctx.admin
    .from("employee_training_schedules")
    .update({
      title: parsed.data.title,
      description: parsed.data.description || null,
      training_type: parsed.data.trainingType,
      scheduled_start: new Date(parsed.data.scheduledStart).toISOString(),
      scheduled_end: new Date(parsed.data.scheduledEnd).toISOString(),
      timezone: parsed.data.timezone,
      location: parsed.data.location || null,
      meeting_url: parsed.data.meetingUrl || null,
      status: statusParsed.data,
    })
    .eq("id", trainingId)
    .eq("organization_id", ctx.organizationId)
    .is("deleted_at", null)
    .select("employee_id")
    .maybeSingle();
  if (error || !training) return { ok: false, message: error?.message || "Training not found." };
  if (statusParsed.data === "completed") {
    const { data: onboarding } = await ctx.admin
      .from("employee_onboarding")
      .select("id")
      .eq("employee_id", training.employee_id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (onboarding)
      await ctx.admin
        .from("employee_onboarding")
        .update({ status: "completed", completed_at: new Date().toISOString() })
        .eq("id", onboarding.id);
  }
  refreshPreboarding();
  return { ok: true, message: "Training schedule updated." };
}

export async function archiveEmployeeTraining(
  trainingId: string,
): Promise<PreboardingMutationResult> {
  const ctx = await hrContext();
  if (!ctx || !z.string().uuid().safeParse(trainingId).success)
    return { ok: false, message: "Training could not be archived." };
  const { error } = await ctx.admin
    .from("employee_training_schedules")
    .update({ status: "cancelled", deleted_at: new Date().toISOString() })
    .eq("id", trainingId)
    .eq("organization_id", ctx.organizationId);
  if (error) return { ok: false, message: error.message };
  refreshPreboarding();
  return { ok: true, message: "Training schedule archived." };
}

export async function uploadOwnRequirement(
  requirementId: string,
  formData: FormData,
): Promise<PreboardingMutationResult> {
  if (!isSupabaseConfigured() || !isAdminConfigured())
    return { ok: false, message: "Document storage is not configured." };
  const session = await createClient();
  const {
    data: { user },
  } = await session.auth.getUser();
  if (!user || !z.string().uuid().safeParse(requirementId).success)
    return { ok: false, message: "Sign in to submit this requirement." };
  const { data: assurance } =
    await session.auth.mfa.getAuthenticatorAssuranceLevel();
  if (assurance?.currentLevel !== "aal2")
    return { ok: false, message: "Complete multi-factor authentication before uploading documents." };
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0)
    return { ok: false, message: "Choose a document to upload." };
  const allowed = new Set(["application/pdf", "image/jpeg", "image/png"]);
  if (!allowed.has(file.type) || file.size > 4 * 1024 * 1024)
    return { ok: false, message: "Use a PDF, JPG, or PNG file up to 4 MB." };

  const admin = createAdminClient();
  const { data: lifecycle } = await admin
    .from("employee_account_lifecycle")
    .select("id,employee_id,organization_id,access_status")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!lifecycle || lifecycle.access_status === "suspended")
    return { ok: false, message: "Your onboarding access is unavailable." };
  const { data: requirement } = await admin
    .from("employee_requirement_requests")
    .select("id,title,document_type_id,employee_document_id,status")
    .eq("id", requirementId)
    .eq("employee_id", lifecycle.employee_id)
    .is("deleted_at", null)
    .maybeSingle();
  if (!requirement) return { ok: false, message: "Requirement not found." };

  const extension = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "bin";
  const documentId = requirement.employee_document_id || randomUUID();
  const path = `${lifecycle.organization_id}/${lifecycle.employee_id}/${documentId}/${randomUUID()}.${extension}`;
  const { error: uploadError } = await admin.storage
    .from("employee-documents")
    .upload(path, file, { contentType: file.type, upsert: false });
  if (uploadError) return { ok: false, message: uploadError.message };

  try {
    if (!requirement.employee_document_id) {
      const { error } = await admin.from("employee_documents").insert({
        id: documentId,
        organization_id: lifecycle.organization_id,
        employee_id: lifecycle.employee_id,
        document_type_id: requirement.document_type_id,
        title: requirement.title,
        storage_path: path,
        file_name: file.name,
        verification_status: "pending",
        confidentiality_level: "standard",
        status: "active",
        created_by: user.id,
      });
      if (error) throw error;
    } else {
      const { error } = await admin
        .from("employee_documents")
        .update({ storage_path: path, file_name: file.name, verification_status: "pending" })
        .eq("id", documentId);
      if (error) throw error;
    }
    const { data: latest } = await admin
      .from("document_versions")
      .select("version")
      .eq("employee_document_id", documentId)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();
    const { error: versionError } = await admin.from("document_versions").insert({
      employee_document_id: documentId,
      version: Number(latest?.version || 0) + 1,
      storage_path: path,
      file_name: file.name,
      file_size: file.size,
      mime_type: file.type,
      uploaded_by: user.id,
    });
    if (versionError) throw versionError;
    const { error: requirementError } = await admin
      .from("employee_requirement_requests")
      .update({
        employee_document_id: documentId,
        status: "submitted",
        submitted_at: new Date().toISOString(),
        reviewed_at: null,
        reviewed_by: null,
        review_notes: null,
      })
      .eq("id", requirementId);
    if (requirementError) throw requirementError;
  } catch (error) {
    await admin.storage.from("employee-documents").remove([path]);
    return { ok: false, message: error instanceof Error ? error.message : "Document submission failed." };
  }

  await admin.from("audit_logs").insert({
    organization_id: lifecycle.organization_id,
    actor_id: user.id,
    action: "employee_requirement_submitted",
    entity_type: "employee_requirement_requests",
    entity_id: requirementId,
    metadata: { file_name: file.name, file_size: file.size, mime_type: file.type },
  });
  const promoted = await unlockPermanentAccess(admin, lifecycle.id, user.id);
  refreshPreboarding();
  return {
    ok: true,
    message: promoted
      ? "All requirements were submitted on time. Training is unlocked and your account is now permanent."
      : "Requirement submitted securely for HR review.",
  };
}

export async function getOwnRequirementDownloadUrl(
  requirementId: string,
): Promise<PreboardingMutationResult> {
  if (!isSupabaseConfigured() || !isAdminConfigured())
    return { ok: false, message: "Document storage is not configured." };
  const session = await createClient();
  const {
    data: { user },
  } = await session.auth.getUser();
  if (!user) return { ok: false, message: "Sign in to download documents." };
  const { data: assurance } =
    await session.auth.mfa.getAuthenticatorAssuranceLevel();
  if (assurance?.currentLevel !== "aal2")
    return { ok: false, message: "Complete multi-factor authentication before downloading documents." };
  const admin = createAdminClient();
  const { data: requirement } = await admin
    .from("employee_requirement_requests")
    .select("employee_document_id,employees!inner(user_id),employee_documents(storage_path,file_name)")
    .eq("id", requirementId)
    .eq("employees.user_id", user.id)
    .is("deleted_at", null)
    .maybeSingle();
  const document = requirement?.employee_documents as unknown as {
    storage_path?: string;
    file_name?: string;
  } | null;
  if (!document?.storage_path) return { ok: false, message: "No submitted file was found." };
  const { data, error } = await admin.storage
    .from("employee-documents")
    .createSignedUrl(document.storage_path, 60, { download: document.file_name || true });
  if (error) return { ok: false, message: error.message };
  return { ok: true, message: "Secure download prepared.", url: data.signedUrl };
}

async function unlockPermanentAccess(
  admin: ReturnType<typeof createAdminClient>,
  lifecycleId: string,
  actorId: string,
) {
  const { data: lifecycle } = await admin
    .from("employee_account_lifecycle")
    .select("id,organization_id,employee_id,user_id,access_status,requirements_due_date")
    .eq("id", lifecycleId)
    .maybeSingle();
  if (!lifecycle || lifecycle.access_status !== "temporary") return false;
  const { data: requirements } = await admin
    .from("employee_requirement_requests")
    .select("status,submitted_at,due_date,required")
    .eq("employee_id", lifecycle.employee_id)
    .is("deleted_at", null);
  const required = (requirements || []).filter((item) => item.required);
  const ready =
    required.length > 0 &&
    required.every(
      (item) =>
        item.status === "waived" ||
        (item.submitted_at &&
          !["pending", "rejected"].includes(item.status) &&
          item.submitted_at.slice(0, 10) <= item.due_date),
    );
  if (!ready) return false;

  const now = new Date().toISOString();
  const { data: trainings } = await admin
    .from("employee_training_schedules")
    .update({ status: "scheduled", notified_at: now })
    .eq("employee_id", lifecycle.employee_id)
    .eq("status", "pending_requirements")
    .is("deleted_at", null)
    .select("id,title,scheduled_start");
  if (!trainings?.length) return false;

  await admin
    .from("employee_account_lifecycle")
    .update({ access_status: "permanent", permanent_at: now, suspended_at: null })
    .eq("id", lifecycle.id);
  await admin.from("profiles").update({ status: "active" }).eq("id", lifecycle.user_id);
  const { data: roles } = await admin
    .from("roles")
    .select("id,key")
    .in("key", ["preboarding_employee", "employee"]);
  const temporaryRole = roles?.find((role) => role.key === "preboarding_employee");
  const employeeRole = roles?.find((role) => role.key === "employee");
  if (temporaryRole)
    await admin
      .from("user_roles")
      .delete()
      .eq("user_id", lifecycle.user_id)
      .eq("role_id", temporaryRole.id);
  if (employeeRole)
    await admin
      .from("user_roles")
      .upsert({ user_id: lifecycle.user_id, role_id: employeeRole.id });
  await admin
    .from("employee_onboarding")
    .update({ status: "ready" })
    .eq("employee_id", lifecycle.employee_id)
    .neq("status", "completed")
    .is("deleted_at", null);

  const firstTraining = trainings[0];
  await admin.from("notifications").insert({
    organization_id: lifecycle.organization_id,
    recipient_id: lifecycle.user_id,
    title: "Training schedule available",
    body: `${firstTraining.title} is scheduled for ${new Date(firstTraining.scheduled_start).toLocaleString("en-PH")}. Your permanent employee access is now active.`,
    event_type: "training_scheduled_account_promoted",
    entity_type: "employee_training_schedules",
    entity_id: firstTraining.id,
    href: "/employee/onboarding",
    status: "unread",
  });
  await admin.from("audit_logs").insert({
    organization_id: lifecycle.organization_id,
    actor_id: actorId,
    action: "employee_access_promoted",
    entity_type: "employee_account_lifecycle",
    entity_id: lifecycle.id,
    before_values: { access_status: "temporary" },
    after_values: { access_status: "permanent", permanent_at: now },
  });
  return true;
}
