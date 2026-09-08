"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import "pdf-parse/worker";
import { PDFParse } from "pdf-parse";
import { z } from "zod";
import { createApplicantNotification } from "@/lib/applicant-notifications";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";

export type RecruitmentMutationResult =
  | { ok: true; message: string; url?: string }
  | { ok: false; message: string };

const accessMessage =
  "Sign in with MFA using an HR role that can manage applicants.";

async function context(permission: "applicants.edit" | "applicants.view" = "applicants.edit") {
  if (!isSupabaseConfigured()) return null;
  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return null;
  const [{ data: profile }, { data: assurance }, { data: allowed }] =
    await Promise.all([
      db
        .from("profiles")
        .select("organization_id")
        .eq("id", user.id)
        .single(),
      db.auth.mfa.getAuthenticatorAssuranceLevel(),
      db.rpc("has_permission", { permission_key: permission }),
    ]);
  if (
    !profile?.organization_id ||
    assurance?.currentLevel !== "aal2" ||
    !allowed
  )
    return null;
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
  if (!ctx) return { ok: false, message: accessMessage };

  const { data: application } = await ctx.db
    .from("job_applications")
    .select(
      "id,applicant_id,current_stage_id,application_status,hired_at,applicants(first_name,email),job_vacancies(title)",
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
  if (application.current_stage_id === stage.id)
    return { ok: false, message: `The application is already in ${stage.name}.` };

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
  if (isHired)
    return {
      ok: false,
      message: "Use Hire & onboard so the employee record and temporary account are created safely.",
    };
  if ((isRejected || isWithdrawn || application.application_status !== "in_progress") && (parsed.data.reason || "").trim().length < 3)
    return {
      ok: false,
      message: "Add a decision reason before closing or reopening an application.",
    };
  if (passedResumeScreening) {
    const { data: resume } = await ctx.db
      .from("applicant_documents")
      .select("verification_status")
      .eq("job_application_id", application.id)
      .eq("document_type", "resume")
      .is("deleted_at", null)
      .order("uploaded_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (resume?.verification_status !== "verified")
      return {
        ok: false,
        message: "Verify the applicant's resume before moving beyond Resume Screening.",
      };
  }
  const { error: transitionError } = await ctx.db.rpc(
    "transition_job_application",
    {
      application_uuid: application.id,
      target_stage_uuid: stage.id,
      reason_text: parsed.data.reason || null,
      profile_token_hash_value: null,
      profile_token_expires_value: null,
    },
  );
  if (transitionError) {
    const migrationMissing =
      transitionError.code === "PGRST202" ||
      transitionError.message.includes("Could not find the function");
    return {
      ok: false,
      message: migrationMissing
        ? "Run the complete 202609080008_admin_access_permissions.sql migration in Supabase, then try again."
        : transitionError.message,
    };
  }

  const applicant = application.applicants as unknown as {
    first_name?: string;
    email?: string;
  } | null;
  const vacancy = application.job_vacancies as unknown as { title?: string } | null;
  let notificationWarning = "";
  if (applicant?.email && (passedResumeScreening || interviewStage || isRejected)) {
    const subject = interviewStage
      ? `Interview update for ${vacancy?.title || "your application"}`
      : isHired
        ? `Application decision: ${vacancy?.title || "your application"}`
        : isRejected
          ? `Application update: ${vacancy?.title || "your application"}`
          : `Resume screening update for ${vacancy?.title || "your application"}`;
    const body = interviewStage
      ? `Hi ${applicant.first_name || "there"}, you are qualified for an interview and your application has progressed to ${stage.name}. The recruitment team will share scheduling details with you. Use Track application to view updates.`
      : isHired
        ? `Hi ${applicant.first_name || "there"}, congratulations. You have been selected for ${vacancy?.title || "the position"}. The HR team will contact you with the next steps.`
        : isRejected
          ? `Hi ${applicant.first_name || "there"}, thank you for your interest in ${vacancy?.title || "the position"}. After review, your application was not selected for this role. Your information remains available to the HR team for appropriate future opportunities.`
          : `Hi ${applicant.first_name || "there"}, your resume passed the initial screening for ${vacancy?.title || "the position"}. No duplicate education or experience form is required. HR will notify you separately if you qualify for an interview.`;
    try {
      await createApplicantNotification(ctx, {
        applicantId: application.applicant_id,
        applicationId: application.id,
        recipient: applicant.email,
        eventType: interviewStage
          ? "qualified_for_interview"
          : isRejected
            ? "rejected"
            : "resume_screening_passed",
        subject,
        body,
      });
    } catch {
      notificationWarning = " The stage was saved, but the notification could not be queued.";
    }
  }

  refreshApplicant(application.applicant_id);
  return { ok: true, message: `Application moved to ${stage.name}.${notificationWarning}` };
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
  if (!ctx) return { ok: false, message: accessMessage };
  const { data: application } = await ctx.db
    .from("job_applications")
    .select("id,applicant_id,application_status,recruitment_stages(name),applicants(first_name,email),job_vacancies(title)")
    .eq("id", parsed.data.applicationId)
    .eq("organization_id", ctx.organizationId)
    .maybeSingle();
  if (!application) return { ok: false, message: "Application could not be found." };
  if (application.application_status !== "in_progress")
    return { ok: false, message: "Interviews can be scheduled only for an active application." };
  const currentStage = application.recruitment_stages as unknown as { name?: string } | null;
  if (!currentStage?.name?.toLowerCase().includes("interview"))
    return {
      ok: false,
      message: "Move the application to an interview stage before scheduling the interview.",
    };
  const { data: verifiedResume } = await ctx.db
    .from("applicant_documents")
    .select("id")
    .eq("job_application_id", application.id)
    .eq("document_type", "resume")
    .eq("verification_status", "verified")
    .is("deleted_at", null)
    .limit(1)
    .maybeSingle();
  if (!verifiedResume)
    return { ok: false, message: "Verify the applicant's resume before scheduling an interview." };
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

  const applicant = application.applicants as unknown as {
    first_name?: string;
    email?: string;
  } | null;
  const vacancy = application.job_vacancies as unknown as { title?: string } | null;
  let notificationWarning = "";
  if (applicant?.email) {
    try {
      await createApplicantNotification(ctx, {
        applicantId: application.applicant_id,
        applicationId,
        recipient: applicant.email,
        eventType: "interview_scheduled",
        subject: `Interview scheduled for ${vacancy?.title || "your application"}`,
        body: `Hi ${applicant.first_name || "there"}, you are qualified for an interview. Your ${type} is scheduled for ${new Date(scheduledStart).toLocaleString("en-PH", { timeZone: rest.timezone })}. ${rest.location ? `Location: ${rest.location}.` : ""} ${meetingUrl ? `Meeting link: ${meetingUrl}.` : ""}`.trim(),
      });
    } catch {
      notificationWarning = " The interview was saved, but the notification could not be queued.";
    }
  }
  refreshApplicant(application.applicant_id);
  return { ok: true, message: `Interview scheduled.${notificationWarning || " Applicant notified."}` };
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
  if (!ctx) return { ok: false, message: accessMessage };
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
    .select("id,applicant_id,job_vacancy_id,application_status")
    .eq("id", applicationId)
    .eq("organization_id", ctx.organizationId)
    .maybeSingle();
  if (!application) return { ok: false, message: "Application could not be found." };
  if (application.application_status !== "in_progress")
    return { ok: false, message: "Only active applications can be assessed." };
  const { data: verifiedResume, error: resumeReadError } = await ctx.db
    .from("applicant_documents")
    .select("id,extracted_text,storage_path,mime_type")
    .eq("job_application_id", application.id)
    .eq("document_type", "resume")
    .eq("verification_status", "verified")
    .is("deleted_at", null)
    .limit(1)
    .maybeSingle();
  if (
    resumeReadError?.code === "42703" ||
    resumeReadError?.message.includes("extracted_text")
  )
    return {
      ok: false,
      message: "Run 202609080009_simplify_screened_profile.sql in Supabase before generating the assessment.",
    };
  if (!verifiedResume)
    return { ok: false, message: "Verify the applicant's resume before generating a match assessment." };
  let resumeText = verifiedResume.extracted_text || "";
  if (!resumeText && verifiedResume.mime_type === "application/pdf") {
    const { data: resumeFile, error: downloadError } = await ctx.db.storage
      .from("applicant-documents")
      .download(verifiedResume.storage_path);
    if (downloadError || !resumeFile)
      return { ok: false, message: "The verified resume could not be read from secure storage." };
    const parser = new PDFParse({
      data: new Uint8Array(await resumeFile.arrayBuffer()),
    });
    try {
      const parsedResume = await parser.getText({ first: 6 });
      resumeText = parsedResume.text.slice(0, 50_000);
      const { error: cacheError } = await ctx.db
        .from("applicant_documents")
        .update({ extracted_text: resumeText })
        .eq("id", verifiedResume.id)
        .eq("organization_id", ctx.organizationId);
      if (cacheError) return { ok: false, message: cacheError.message };
    } catch {
      return {
        ok: false,
        message: "The verified resume is not searchable. Ask the applicant for a searchable PDF.",
      };
    } finally {
      await parser.destroy();
    }
  }
  const vacancyResult = await ctx.db
    .from("job_vacancies")
    .select("title,qualifications,required_skills,preferred_skills")
    .eq("id", application.job_vacancy_id)
    .single();
  if (vacancyResult.error)
    return { ok: false, message: "Candidate or vacancy details are incomplete." };

  const vacancy = vacancyResult.data;
  const candidateText = resumeText.toLowerCase();
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
  const requiredScore = required.length
    ? (requiredMatches.length / required.length) * 55
    : 25;
  const preferredScore = preferred.length
    ? (preferredMatches.length / preferred.length) * 20
    : 10;
  const titleScore = Math.min(titleMatches * 5, 15);
  const resumeEvidenceScore = resumeText ? 10 : 0;
  const score = Math.round(
    Math.min(100, requiredScore + preferredScore + titleScore + resumeEvidenceScore),
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
    ...(resumeText ? ["Searchable resume evidence included"] : []),
  ];
  const missingRequired = required.filter((skill) => !requiredMatches.includes(skill));
  const concerns = [
    ...(missingRequired.length
      ? [`Not evidenced in submitted information: ${missingRequired.join(", ")}`]
      : []),
    ...(!resumeText
      ? ["Resume text was not captured for this older application"]
      : []),
  ];
  const summary = `Job-related fit score ${score}/100 based on the submitted resume and vacancy criteria. This is decision support only; every candidate requires human review.`;
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
  const ctx = await context("applicants.view");
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
  if (!allowed.has(file.type) || file.size > 4 * 1024 * 1024)
    return { ok: false, message: "Use a PDF, DOC, DOCX, JPG, or PNG file up to 4 MB." };
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
