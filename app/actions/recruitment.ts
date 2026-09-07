"use server";

import { createHash, randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createApplicantNotification } from "@/lib/applicant-notifications";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";

export type RecruitmentMutationResult =
  | { ok: true; message: string; url?: string }
  | { ok: false; message: string };

async function context() {
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

function refreshApplicant(applicantId: string) {
  revalidatePath("/hr/dashboard");
  revalidatePath("/hr/recruitment/applicants");
  revalidatePath(`/hr/recruitment/applicants/${applicantId}`);
}

const stageInput = z.object({
  applicationId: z.string().uuid(),
  stageId: z.string().uuid(),
  reason: z.string().trim().max(1000).optional(),
});

export async function updateApplicationStage(
  raw: z.input<typeof stageInput>,
): Promise<RecruitmentMutationResult> {
  if (!isSupabaseConfigured())
    return { ok: true, message: "Application stage updated in preview mode." };
  const parsed = stageInput.safeParse(raw);
  if (!parsed.success) return { ok: false, message: "Select a valid stage." };
  const ctx = await context();
  if (!ctx) return { ok: false, message: "Sign in to update this application." };

  const { data: application } = await ctx.db
    .from("job_applications")
    .select(
      "id,applicant_id,current_stage_id,application_status,profile_completion_status,hired_at,applicants(first_name,email),job_vacancies(title)",
    )
    .eq("id", parsed.data.applicationId)
    .eq("organization_id", ctx.organizationId)
    .maybeSingle();
  if (!application)
    return { ok: false, message: "Application could not be found." };
  const { data: stage } = await ctx.db
    .from("recruitment_stages")
    .select("id,name,stage_type,stage_order")
    .eq("id", parsed.data.stageId)
    .eq("organization_id", ctx.organizationId)
    .eq("is_active", true)
    .maybeSingle();
  if (!stage) return { ok: false, message: "Recruitment stage is unavailable." };

  const { data: screeningStage } = await ctx.db
    .from("recruitment_stages")
    .select("stage_order")
    .eq("organization_id", ctx.organizationId)
    .ilike("name", "%screen%")
    .eq("is_active", true)
    .order("stage_order")
    .limit(1)
    .maybeSingle();

  const isHired = stage.stage_type === "hired";
  const isRejected = stage.stage_type === "rejected";
  const isWithdrawn = stage.stage_type === "withdrawn";
  const interviewStage = stage.name.toLowerCase().includes("interview");
  const passedResumeScreening =
    stage.stage_type === "active" &&
    stage.stage_order > Number(screeningStage?.stage_order ?? 20);
  const requestProfile =
    passedResumeScreening && application.profile_completion_status === "not_requested";
  const profileToken = requestProfile
    ? `${randomUUID().replaceAll("-", "")}${randomUUID().replaceAll("-", "")}`
    : null;
  const nextStatus = isHired
    ? "hired"
    : isRejected
      ? "rejected"
      : isWithdrawn
        ? "withdrawn"
        : "in_progress";
  const update = {
    current_stage_id: stage.id,
    application_status: nextStatus,
    final_result: isHired ? "hired" : isRejected ? "rejected" : null,
    rejection_reason: isRejected ? parsed.data.reason || "Not selected" : null,
    hired_at: isHired ? new Date().toISOString() : null,
    withdrawn_at: isWithdrawn ? new Date().toISOString() : null,
    ...(requestProfile && profileToken
      ? {
          profile_completion_status: "requested",
          profile_completion_token_hash: createHash("sha256").update(profileToken).digest("hex"),
          profile_completion_token_expires_at: new Date(
            Date.now() + 14 * 24 * 60 * 60 * 1000,
          ).toISOString(),
        }
      : {}),
  };
  const { error } = await ctx.db
    .from("job_applications")
    .update(update)
    .eq("id", application.id)
    .eq("organization_id", ctx.organizationId);
  if (error) return { ok: false, message: error.message };
  await ctx.db.from("application_stage_history").insert({
    job_application_id: application.id,
    from_stage_id: application.current_stage_id,
    to_stage_id: stage.id,
    changed_by: ctx.user.id,
    reason: parsed.data.reason || `Moved to ${stage.name}`,
  });
  if (isHired)
    await ctx.db
      .from("applicants")
      .update({ status: "hired" })
      .eq("id", application.applicant_id);

  const applicant = application.applicants as unknown as {
    first_name?: string;
    email?: string;
  } | null;
  const vacancy = application.job_vacancies as unknown as { title?: string } | null;
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");
  const profileUrl = profileToken
    ? `${siteUrl}/careers/track?token=${encodeURIComponent(profileToken)}`
    : null;
  if (applicant?.email && (requestProfile || interviewStage || isHired || isRejected)) {
    const subject = interviewStage
      ? `Interview update for ${vacancy?.title || "your application"}`
      : isHired
        ? `Application decision: ${vacancy?.title || "your application"}`
        : isRejected
          ? `Application update: ${vacancy?.title || "your application"}`
          : `Resume screening update for ${vacancy?.title || "your application"}`;
    const body = interviewStage
      ? `Hi ${applicant.first_name || "there"}, you are qualified for an interview and your application has progressed to ${stage.name}. ${profileUrl ? `Complete your full applicant profile using this secure link: ${profileUrl}.` : "Use the secure profile link from your earlier screening update if your details are still incomplete."} The recruitment team will share scheduling details with you.`
      : isHired
        ? `Hi ${applicant.first_name || "there"}, congratulations. You have been selected for ${vacancy?.title || "the position"}. The HR team will contact you with the next steps.`
        : isRejected
          ? `Hi ${applicant.first_name || "there"}, thank you for your interest in ${vacancy?.title || "the position"}. After review, your application was not selected for this role. Your information remains available to the HR team for appropriate future opportunities.`
          : `Hi ${applicant.first_name || "there"}, your resume passed the initial screening for ${vacancy?.title || "the position"}. Please complete your professional and education profile within 14 days using this secure link: ${profileUrl}. This screening result is not yet an interview invitation; HR will notify you separately if you qualify for an interview.`;
    await createApplicantNotification(ctx, {
      applicantId: application.applicant_id,
      applicationId: application.id,
      recipient: applicant.email,
      eventType: interviewStage
        ? "qualified_for_interview"
        : isHired
          ? "hired"
          : isRejected
            ? "rejected"
            : "resume_screening_passed",
      subject,
      body,
    });
  }

  await ctx.db.from("audit_logs").insert({
    organization_id: ctx.organizationId,
    actor_id: ctx.user.id,
    action: "application_stage_update",
    entity_type: "job_applications",
    entity_id: application.id,
    before_values: {
      current_stage_id: application.current_stage_id,
      application_status: application.application_status,
    },
    after_values: update,
  });
  refreshApplicant(application.applicant_id);
  return { ok: true, message: `Application moved to ${stage.name}.` };
}

const interviewInput = z
  .object({
    applicationId: z.string().uuid(),
    type: z.string().trim().min(2).max(80),
    scheduledStart: z.string().min(1),
    scheduledEnd: z.string().min(1),
    timezone: z.string().trim().min(1).max(80),
    location: z.string().trim().max(300).optional(),
    meetingUrl: z.union([z.url(), z.literal("")]).optional(),
    instructions: z.string().trim().max(2000).optional(),
  })
  .refine(
    (value) => new Date(value.scheduledEnd) > new Date(value.scheduledStart),
    { message: "The interview end time must be after its start time." },
  );

export async function createInterview(
  raw: z.input<typeof interviewInput>,
): Promise<RecruitmentMutationResult> {
  if (!isSupabaseConfigured())
    return { ok: true, message: "Interview scheduled in preview mode." };
  const parsed = interviewInput.safeParse(raw);
  if (!parsed.success)
    return { ok: false, message: parsed.error.issues[0]?.message || "Check the interview details." };
  const ctx = await context();
  if (!ctx) return { ok: false, message: "Sign in to schedule interviews." };
  const { data: application } = await ctx.db
    .from("job_applications")
    .select("id,applicant_id,profile_completion_status,applicants(first_name,email),job_vacancies(title)")
    .eq("id", parsed.data.applicationId)
    .eq("organization_id", ctx.organizationId)
    .maybeSingle();
  if (!application) return { ok: false, message: "Application could not be found." };
  const { applicationId, type, scheduledStart, scheduledEnd, meetingUrl, ...rest } =
    parsed.data;
  const { error } = await ctx.db.from("interviews").insert({
    organization_id: ctx.organizationId,
    job_application_id: applicationId,
    interview_type: type,
    scheduled_start: scheduledStart,
    scheduled_end: scheduledEnd,
    meeting_url: meetingUrl || null,
    ...rest,
    status: "scheduled",
    created_by: ctx.user.id,
  });
  if (error) return { ok: false, message: error.message };

  const profileToken =
    application.profile_completion_status === "not_requested"
      ? `${randomUUID().replaceAll("-", "")}${randomUUID().replaceAll("-", "")}`
      : null;
  if (profileToken) {
    const { error: requestError } = await ctx.db
      .from("job_applications")
      .update({
        profile_completion_status: "requested",
        profile_completion_token_hash: createHash("sha256").update(profileToken).digest("hex"),
        profile_completion_token_expires_at: new Date(
          Date.now() + 14 * 24 * 60 * 60 * 1000,
        ).toISOString(),
      })
      .eq("id", applicationId)
      .eq("organization_id", ctx.organizationId);
    if (requestError) return { ok: false, message: requestError.message };
  }

  const applicant = application.applicants as unknown as {
    first_name?: string;
    email?: string;
  } | null;
  const vacancy = application.job_vacancies as unknown as { title?: string } | null;
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");
  const profileInstruction = profileToken
    ? ` Complete your full applicant profile using this secure link: ${siteUrl}/careers/track?token=${encodeURIComponent(profileToken)}.`
    : application.profile_completion_status === "requested"
      ? " Use the secure profile-completion link from your qualification update if your details are still incomplete."
      : "";
  if (applicant?.email)
    await createApplicantNotification(ctx, {
      applicantId: application.applicant_id,
      applicationId,
      recipient: applicant.email,
      eventType: "interview_scheduled",
      subject: `Interview scheduled for ${vacancy?.title || "your application"}`,
      body: `Hi ${applicant.first_name || "there"}, you are qualified for an interview. Your ${type} is scheduled for ${new Date(scheduledStart).toLocaleString("en-PH", { timeZone: rest.timezone })}. ${rest.location ? `Location: ${rest.location}.` : ""} ${meetingUrl ? `Meeting link: ${meetingUrl}.` : ""}${profileInstruction}`.trim(),
    });
  refreshApplicant(application.applicant_id);
  return { ok: true, message: "Interview scheduled and applicant notified." };
}

export async function sendApplicantProfileRequest(
  applicationId: string,
): Promise<RecruitmentMutationResult> {
  if (!isSupabaseConfigured())
    return { ok: true, message: "Secure profile request sent in preview mode." };
  if (!z.string().uuid().safeParse(applicationId).success)
    return { ok: false, message: "Application could not be found." };
  const ctx = await context();
  if (!ctx) return { ok: false, message: "Sign in to send a profile request." };

  const { data: application } = await ctx.db
    .from("job_applications")
    .select("id,applicant_id,profile_completion_status,application_status,applicants(first_name,email),job_vacancies(title)")
    .eq("id", applicationId)
    .eq("organization_id", ctx.organizationId)
    .maybeSingle();
  if (!application) return { ok: false, message: "Application could not be found." };
  if (application.profile_completion_status === "completed")
    return { ok: false, message: "The applicant has already completed this profile." };
  if (application.application_status !== "in_progress")
    return { ok: false, message: "Profile requests are available only for active applications." };

  const applicant = application.applicants as unknown as {
    first_name?: string;
    email?: string;
  } | null;
  if (!applicant?.email)
    return { ok: false, message: "The applicant does not have a delivery email." };

  const profileToken = `${randomUUID().replaceAll("-", "")}${randomUUID().replaceAll("-", "")}`;
  const { error: updateError } = await ctx.db
    .from("job_applications")
    .update({
      profile_completion_status: "requested",
      profile_completion_token_hash: createHash("sha256").update(profileToken).digest("hex"),
      profile_completion_token_expires_at: new Date(
        Date.now() + 14 * 24 * 60 * 60 * 1000,
      ).toISOString(),
    })
    .eq("id", application.id)
    .eq("organization_id", ctx.organizationId);
  if (updateError) return { ok: false, message: updateError.message };

  const vacancy = application.job_vacancies as unknown as { title?: string } | null;
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");
  await createApplicantNotification(ctx, {
    applicantId: application.applicant_id,
    applicationId: application.id,
    recipient: applicant.email,
    eventType: "profile_completion_requested",
    subject: `Complete your applicant profile for ${vacancy?.title || "your application"}`,
    body: `Hi ${applicant.first_name || "there"}, please complete your professional and education profile within 14 days using this secure single-use link: ${siteUrl}/careers/track?token=${encodeURIComponent(profileToken)}.`,
  });
  refreshApplicant(application.applicant_id);
  return { ok: true, message: "A new secure profile link was sent to the applicant." };
}

export async function updateInterview(
  interviewId: string,
  raw: z.input<typeof interviewInput>,
): Promise<RecruitmentMutationResult> {
  if (!isSupabaseConfigured())
    return { ok: true, message: "Interview updated in preview mode." };
  const parsed = interviewInput.safeParse(raw);
  if (!z.string().uuid().safeParse(interviewId).success || !parsed.success)
    return { ok: false, message: parsed.success ? "Invalid interview." : parsed.error.issues[0]?.message || "Check the interview details." };
  const ctx = await context();
  if (!ctx) return { ok: false, message: "Sign in to update interviews." };
  const { data: interview } = await ctx.db
    .from("interviews")
    .select("id,job_application_id,job_applications(applicant_id)")
    .eq("id", interviewId)
    .eq("organization_id", ctx.organizationId)
    .maybeSingle();
  if (!interview) return { ok: false, message: "Interview could not be found." };
  const { type, scheduledStart, scheduledEnd, meetingUrl, applicationId: _, ...rest } =
    parsed.data;
  const { error } = await ctx.db
    .from("interviews")
    .update({
      interview_type: type,
      scheduled_start: scheduledStart,
      scheduled_end: scheduledEnd,
      meeting_url: meetingUrl || null,
      ...rest,
    })
    .eq("id", interviewId)
    .eq("organization_id", ctx.organizationId);
  if (error) return { ok: false, message: error.message };
  const application = interview.job_applications as unknown as { applicant_id?: string } | null;
  if (application?.applicant_id) refreshApplicant(application.applicant_id);
  return { ok: true, message: "Interview updated." };
}

export async function cancelInterview(
  interviewId: string,
): Promise<RecruitmentMutationResult> {
  if (!isSupabaseConfigured())
    return { ok: true, message: "Interview cancelled in preview mode." };
  const ctx = await context();
  if (!ctx || !z.string().uuid().safeParse(interviewId).success)
    return { ok: false, message: "Interview could not be cancelled." };
  const { data: interview } = await ctx.db
    .from("interviews")
    .select("id,job_applications(applicant_id)")
    .eq("id", interviewId)
    .eq("organization_id", ctx.organizationId)
    .maybeSingle();
  if (!interview) return { ok: false, message: "Interview could not be found." };
  const { error } = await ctx.db
    .from("interviews")
    .update({ status: "cancelled" })
    .eq("id", interviewId);
  if (error) return { ok: false, message: error.message };
  const application = interview.job_applications as unknown as { applicant_id?: string } | null;
  if (application?.applicant_id) refreshApplicant(application.applicant_id);
  return { ok: true, message: "Interview cancelled. Its history was retained." };
}

const evaluationInput = z.object({
  recommendation: z.enum(["strong_yes", "yes", "mixed", "no"]),
  comments: z.string().trim().min(3, "Add a short evidence-based comment.").max(4000),
});

export async function saveInterviewEvaluation(
  interviewId: string,
  raw: z.input<typeof evaluationInput>,
): Promise<RecruitmentMutationResult> {
  if (!isSupabaseConfigured())
    return { ok: true, message: "Interview evaluation saved in preview mode." };
  const parsed = evaluationInput.safeParse(raw);
  const ctx = await context();
  if (!ctx || !z.string().uuid().safeParse(interviewId).success || !parsed.success)
    return {
      ok: false,
      message: parsed.success
        ? "Interview could not be evaluated."
        : parsed.error.issues[0]?.message || "Check the evaluation.",
    };
  const { data: interview } = await ctx.db
    .from("interviews")
    .select("id,job_applications(applicant_id)")
    .eq("id", interviewId)
    .eq("organization_id", ctx.organizationId)
    .maybeSingle();
  if (!interview) return { ok: false, message: "Interview could not be found." };
  const { error } = await ctx.db.from("interview_evaluations").upsert(
    {
      interview_id: interviewId,
      evaluator_id: ctx.user.id,
      recommendation: parsed.data.recommendation,
      comments: parsed.data.comments,
      submitted_at: new Date().toISOString(),
    },
    { onConflict: "interview_id,evaluator_id" },
  );
  if (error) return { ok: false, message: error.message };
  await ctx.db
    .from("interviews")
    .update({ status: "completed" })
    .eq("id", interviewId);
  const application = interview.job_applications as unknown as { applicant_id?: string } | null;
  if (application?.applicant_id) refreshApplicant(application.applicant_id);
  return { ok: true, message: "Interview evaluation submitted." };
}

function words(value: unknown) {
  return new Set(
    String(value || "")
      .toLowerCase()
      .replace(/[^a-z0-9+#. ]/g, " ")
      .split(/\s+/)
      .filter((word) => word.length > 2),
  );
}

function phraseMatched(phrase: string, candidateText: string, candidateWords: Set<string>) {
  const normalized = phrase.toLowerCase().trim();
  if (!normalized) return false;
  if (candidateText.includes(normalized)) return true;
  const tokens = [...words(normalized)];
  return tokens.length > 0 && tokens.every((token) => candidateWords.has(token));
}

export async function generateAiAssessment(
  applicationId: string,
): Promise<RecruitmentMutationResult> {
  if (!isSupabaseConfigured())
    return { ok: true, message: "AI-assisted assessment generated in preview mode." };
  const ctx = await context();
  if (!ctx || !z.string().uuid().safeParse(applicationId).success)
    return { ok: false, message: "Application could not be assessed." };
  const { data: application } = await ctx.db
    .from("job_applications")
    .select("id,applicant_id,job_vacancy_id,cover_letter")
    .eq("id", applicationId)
    .eq("organization_id", ctx.organizationId)
    .maybeSingle();
  if (!application) return { ok: false, message: "Application could not be found." };
  const [applicantResult, vacancyResult, experienceResult, educationResult] =
    await Promise.all([
      ctx.db
        .from("applicants")
        .select("current_job_title,current_employer,years_experience")
        .eq("id", application.applicant_id)
        .single(),
      ctx.db
        .from("job_vacancies")
        .select("title,qualifications,required_skills,preferred_skills")
        .eq("id", application.job_vacancy_id)
        .single(),
      ctx.db
        .from("applicant_experience")
        .select("position,responsibilities,achievements")
        .eq("applicant_id", application.applicant_id),
      ctx.db
        .from("applicant_education")
        .select("school,degree,field_of_study")
        .eq("applicant_id", application.applicant_id),
    ]);
  if (applicantResult.error || vacancyResult.error)
    return { ok: false, message: "Candidate or vacancy details are incomplete." };

  const applicant = applicantResult.data;
  const vacancy = vacancyResult.data;
  const experience = experienceResult.data || [];
  const education = educationResult.data || [];
  const candidateText = [
    applicant.current_job_title,
    applicant.current_employer,
    application.cover_letter,
    ...experience.flatMap((item) => [item.position, item.responsibilities, item.achievements]),
    ...education.flatMap((item) => [item.school, item.degree, item.field_of_study]),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  const candidateWords = words(candidateText);
  const required = (vacancy.required_skills || []) as string[];
  const preferred = (vacancy.preferred_skills || []) as string[];
  const requiredMatches = required.filter((skill) =>
    phraseMatched(skill, candidateText, candidateWords),
  );
  const preferredMatches = preferred.filter((skill) =>
    phraseMatched(skill, candidateText, candidateWords),
  );
  const titleMatches = [...words(vacancy.title)].filter((word) =>
    candidateWords.has(word),
  ).length;
  const yearsScore = Math.min(Number(applicant.years_experience || 0) * 4, 20);
  const requiredScore = required.length
    ? (requiredMatches.length / required.length) * 50
    : Math.min(experience.length * 8, 24);
  const preferredScore = preferred.length
    ? (preferredMatches.length / preferred.length) * 15
    : 5;
  const titleScore = Math.min(titleMatches * 5, 10);
  const contextScore = application.cover_letter ? 5 : 0;
  const score = Math.round(
    Math.min(100, yearsScore + requiredScore + preferredScore + titleScore + contextScore),
  );
  const recommendation =
    score >= 75 ? "strong_match" : score >= 50 ? "potential_match" : "manual_review";
  const strengths = [
    ...(requiredMatches.length
      ? [`Matches required skills: ${requiredMatches.join(", ")}`]
      : []),
    ...(preferredMatches.length
      ? [`Matches preferred skills: ${preferredMatches.join(", ")}`]
      : []),
    ...(Number(applicant.years_experience || 0) > 0
      ? [`${Number(applicant.years_experience)} years of reported experience`]
      : []),
  ];
  const missingRequired = required.filter((skill) => !requiredMatches.includes(skill));
  const concerns = [
    ...(missingRequired.length
      ? [`Not evidenced in submitted information: ${missingRequired.join(", ")}`]
      : []),
    ...(!application.cover_letter ? ["No cover letter was provided"] : []),
  ];
  const summary = `Job-related fit score ${score}/100 based on submitted experience and vacancy criteria. This is decision support only; every candidate requires human review.`;
  const { error } = await ctx.db.from("applicant_ai_assessments").upsert(
    {
      organization_id: ctx.organizationId,
      job_application_id: applicationId,
      score,
      recommendation,
      summary,
      strengths,
      concerns,
      model_name: "hrms-job-fit-engine",
      model_version: "1.0",
      input_snapshot: {
        required_skills: required,
        preferred_skills: preferred,
        matched_required_skills: requiredMatches,
        matched_preferred_skills: preferredMatches,
      },
      generated_by: ctx.user.id,
      generated_at: new Date().toISOString(),
      reviewed_by: null,
      review_decision: null,
      review_notes: null,
      reviewed_at: null,
    },
    { onConflict: "job_application_id" },
  );
  if (error) return { ok: false, message: error.message };
  refreshApplicant(application.applicant_id);
  return {
    ok: true,
    message: "Explainable match assessment generated. Human review is still required.",
  };
}

export async function reviewAiAssessment(
  assessmentId: string,
  decision: "accepted" | "overridden",
  notes: string,
): Promise<RecruitmentMutationResult> {
  if (!isSupabaseConfigured())
    return { ok: true, message: "Assessment review saved in preview mode." };
  const ctx = await context();
  if (!ctx || !z.string().uuid().safeParse(assessmentId).success)
    return { ok: false, message: "Assessment could not be reviewed." };
  const { data: assessment } = await ctx.db
    .from("applicant_ai_assessments")
    .select("id,job_applications(applicant_id)")
    .eq("id", assessmentId)
    .eq("organization_id", ctx.organizationId)
    .maybeSingle();
  if (!assessment) return { ok: false, message: "Assessment could not be found." };
  const { error } = await ctx.db
    .from("applicant_ai_assessments")
    .update({
      review_decision: decision,
      review_notes: notes.trim() || null,
      reviewed_by: ctx.user.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", assessmentId);
  if (error) return { ok: false, message: error.message };
  const application = assessment.job_applications as unknown as { applicant_id?: string } | null;
  if (application?.applicant_id) refreshApplicant(application.applicant_id);
  return { ok: true, message: "Human review recorded." };
}

const documentStatus = z.enum(["submitted", "under_review", "verified", "rejected"]);

export async function updateApplicantDocument(
  documentId: string,
  status: z.input<typeof documentStatus>,
  notes: string,
): Promise<RecruitmentMutationResult> {
  if (!isSupabaseConfigured())
    return { ok: true, message: "Requirement updated in preview mode." };
  const ctx = await context();
  const parsed = documentStatus.safeParse(status);
  if (!ctx || !parsed.success || !z.string().uuid().safeParse(documentId).success)
    return { ok: false, message: "Requirement could not be updated." };
  const { data: document } = await ctx.db
    .from("applicant_documents")
    .select("id,applicant_id")
    .eq("id", documentId)
    .eq("organization_id", ctx.organizationId)
    .maybeSingle();
  if (!document) return { ok: false, message: "Requirement could not be found." };
  const { error } = await ctx.db
    .from("applicant_documents")
    .update({ verification_status: parsed.data, notes: notes.trim() || null })
    .eq("id", documentId);
  if (error) return { ok: false, message: error.message };
  refreshApplicant(document.applicant_id);
  return { ok: true, message: "Requirement review saved." };
}

export async function getApplicantDocumentDownloadUrl(
  documentId: string,
): Promise<RecruitmentMutationResult> {
  if (!isSupabaseConfigured())
    return { ok: false, message: "Downloads require a connected Supabase project." };
  const ctx = await context();
  if (!ctx || !z.string().uuid().safeParse(documentId).success)
    return { ok: false, message: "Document could not be downloaded." };
  const { data: document } = await ctx.db
    .from("applicant_documents")
    .select("storage_path,file_name")
    .eq("id", documentId)
    .eq("organization_id", ctx.organizationId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!document) return { ok: false, message: "Document could not be found." };
  const { data, error } = await ctx.db.storage
    .from("applicant-documents")
    .createSignedUrl(document.storage_path, 60, {
      download: document.file_name || true,
    });
  if (error) return { ok: false, message: error.message };
  return { ok: true, message: "Secure download prepared.", url: data.signedUrl };
}

export async function addApplicantDocument(
  applicationId: string,
  formData: FormData,
): Promise<RecruitmentMutationResult> {
  if (!isSupabaseConfigured())
    return { ok: true, message: "Requirement uploaded in preview mode." };
  const ctx = await context();
  if (!ctx || !z.string().uuid().safeParse(applicationId).success)
    return { ok: false, message: "Application could not be found." };
  const file = formData.get("file");
  const type = String(formData.get("document_type") || "requirement").trim();
  const suppliedTitle = String(formData.get("title") || "").trim();
  if (!(file instanceof File) || file.size === 0)
    return { ok: false, message: "Choose a document to upload." };
  const title = suppliedTitle || file.name;
  const allowed = new Set([
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "image/jpeg",
    "image/png",
  ]);
  if (!allowed.has(file.type) || file.size > 10 * 1024 * 1024)
    return { ok: false, message: "Use a PDF, DOC, DOCX, JPG, or PNG file up to 10 MB." };
  const { data: application } = await ctx.db
    .from("job_applications")
    .select("id,applicant_id")
    .eq("id", applicationId)
    .eq("organization_id", ctx.organizationId)
    .maybeSingle();
  if (!application) return { ok: false, message: "Application could not be found." };
  const extension = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "bin";
  const path = `${ctx.organizationId}/${application.applicant_id}/${applicationId}/${randomUUID()}.${extension}`;
  const { error: uploadError } = await ctx.db.storage
    .from("applicant-documents")
    .upload(path, file, { contentType: file.type, upsert: false });
  if (uploadError) return { ok: false, message: uploadError.message };
  const { error } = await ctx.db.from("applicant_documents").insert({
    organization_id: ctx.organizationId,
    applicant_id: application.applicant_id,
    job_application_id: applicationId,
    document_type: type || "requirement",
    title: title || file.name,
    storage_path: path,
    file_name: file.name,
    file_size: file.size,
    mime_type: file.type,
    verification_status: "submitted",
  });
  if (error) {
    await ctx.db.storage.from("applicant-documents").remove([path]);
    return { ok: false, message: error.message };
  }
  refreshApplicant(application.applicant_id);
  return { ok: true, message: "Applicant requirement uploaded." };
}

export async function archiveApplicantDocument(
  documentId: string,
): Promise<RecruitmentMutationResult> {
  if (!isSupabaseConfigured())
    return { ok: true, message: "Requirement archived in preview mode." };
  const ctx = await context();
  if (!ctx || !z.string().uuid().safeParse(documentId).success)
    return { ok: false, message: "Requirement could not be archived." };
  const { data: document } = await ctx.db
    .from("applicant_documents")
    .select("id,applicant_id")
    .eq("id", documentId)
    .eq("organization_id", ctx.organizationId)
    .maybeSingle();
  if (!document) return { ok: false, message: "Requirement could not be found." };
  const { error } = await ctx.db
    .from("applicant_documents")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", documentId);
  if (error) return { ok: false, message: error.message };
  refreshApplicant(document.applicant_id);
  return { ok: true, message: "Requirement archived. Its audit record remains available." };
}
