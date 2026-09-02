"use server";

import { revalidatePath } from "next/cache";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import type { ApplicantBoardColumn } from "@/lib/hr-data";

export type DashboardMutationResult =
  | { ok: true; message: string }
  | { ok: false; message: string };

async function dashboardContext() {
  if (!isSupabaseConfigured()) return null;
  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return null;
  const { data: profile } = await db
    .from("profiles")
    .select("organization_id")
    .eq("id", user.id)
    .single();
  if (!profile?.organization_id) return null;
  return { db, user, organizationId: profile.organization_id as string };
}

export async function moveApplicationStage(
  applicationId: string,
  column: ApplicantBoardColumn,
): Promise<DashboardMutationResult> {
  if (!isSupabaseConfigured())
    return { ok: true, message: "Applicant moved in preview mode." };

  const ctx = await dashboardContext();
  if (!ctx) return { ok: false, message: "Sign in to update applicants." };

  const { data: application, error: readError } = await ctx.db
    .from("job_applications")
    .select("id,current_stage_id,application_status,hired_at")
    .eq("id", applicationId)
    .eq("organization_id", ctx.organizationId)
    .maybeSingle();
  if (readError || !application)
    return { ok: false, message: "This application is no longer available." };

  const targetName =
    column === "hired"
      ? "Hired"
      : column === "interviewing"
        ? "HR Interview"
        : "Applied";
  const { data: target, error: stageError } = await ctx.db
    .from("recruitment_stages")
    .select("id,name")
    .eq("organization_id", ctx.organizationId)
    .eq("name", targetName)
    .eq("is_active", true)
    .maybeSingle();
  if (stageError || !target)
    return { ok: false, message: `${targetName} is not configured as an active stage.` };
  if (application.current_stage_id === target.id)
    return { ok: true, message: "Applicant is already in this stage." };

  const nextApplication = {
    current_stage_id: target.id,
    application_status: column === "hired" ? "hired" : "in_progress",
    hired_at: column === "hired" ? new Date().toISOString() : null,
  };
  const { error: updateError } = await ctx.db
    .from("job_applications")
    .update(nextApplication)
    .eq("id", applicationId)
    .eq("organization_id", ctx.organizationId);
  if (updateError) return { ok: false, message: updateError.message };

  const { error: historyError } = await ctx.db
    .from("application_stage_history")
    .insert({
      job_application_id: applicationId,
      from_stage_id: application.current_stage_id,
      to_stage_id: target.id,
      changed_by: ctx.user.id,
      reason: "Moved from the HR overview board",
    });
  if (historyError) {
    await ctx.db
      .from("job_applications")
      .update({
        current_stage_id: application.current_stage_id,
        application_status: application.application_status,
        hired_at: application.hired_at,
      })
      .eq("id", applicationId)
      .eq("organization_id", ctx.organizationId);
    return { ok: false, message: historyError.message };
  }

  await ctx.db.from("audit_logs").insert({
    organization_id: ctx.organizationId,
    actor_id: ctx.user.id,
    action: "stage_change",
    entity_type: "job_applications",
    entity_id: applicationId,
    before_values: { current_stage_id: application.current_stage_id },
    after_values: nextApplication,
  });
  revalidatePath("/hr/dashboard");
  revalidatePath("/hr/recruitment/applicants");
  return { ok: true, message: `Applicant moved to ${target.name}.` };
}

export async function toggleOnboardingTask(
  taskId: string,
  completed: boolean,
): Promise<DashboardMutationResult> {
  if (!isSupabaseConfigured())
    return { ok: true, message: "Checklist updated in preview mode." };

  const ctx = await dashboardContext();
  if (!ctx) return { ok: false, message: "Sign in to update onboarding." };

  const { data: task, error: readError } = await ctx.db
    .from("onboarding_tasks")
    .select("id,onboarding_id,status,completed_at,completed_by")
    .eq("id", taskId)
    .maybeSingle();
  if (readError || !task)
    return { ok: false, message: "This onboarding task is no longer available." };

  const taskUpdate = {
    status: completed ? "completed" : "pending",
    completed_at: completed ? new Date().toISOString() : null,
    completed_by: completed ? ctx.user.id : null,
  };
  const { error: updateError } = await ctx.db
    .from("onboarding_tasks")
    .update(taskUpdate)
    .eq("id", taskId);
  if (updateError) return { ok: false, message: updateError.message };

  const { data: tasks, error: tasksError } = await ctx.db
    .from("onboarding_tasks")
    .select("status")
    .eq("onboarding_id", task.onboarding_id);
  if (tasksError) return { ok: false, message: tasksError.message };
  const allComplete = Boolean(tasks?.length) && tasks.every((item) => item.status === "completed");
  await ctx.db
    .from("employee_onboarding")
    .update({
      status: allComplete ? "completed" : "in_progress",
      completed_at: allComplete ? new Date().toISOString() : null,
    })
    .eq("id", task.onboarding_id)
    .eq("organization_id", ctx.organizationId);

  await ctx.db.from("audit_logs").insert({
    organization_id: ctx.organizationId,
    actor_id: ctx.user.id,
    action: completed ? "complete_task" : "reopen_task",
    entity_type: "onboarding_tasks",
    entity_id: taskId,
    before_values: {
      status: task.status,
      completed_at: task.completed_at,
      completed_by: task.completed_by,
    },
    after_values: taskUpdate,
  });
  revalidatePath("/hr/dashboard");
  revalidatePath("/hr/onboarding");
  return {
    ok: true,
    message: completed ? "Task completed." : "Task marked incomplete.",
  };
}
