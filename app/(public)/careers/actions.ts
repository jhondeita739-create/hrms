"use server";

import { createHash, randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import "pdf-parse/worker";
import { PDFParse } from "pdf-parse";
import { z } from "zod";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";

export type ApplicationState = {
  status: "idle" | "error" | "success";
  message?: string;
  reference?: string;
  fieldErrors?: Record<string, string>;
};
const applicationSchema = z.object({
  vacancy_id: z.string().min(1),
  full_name: z
    .string()
    .trim()
    .min(3, "Enter your complete name")
    .max(160),
  email: z.email("Enter a valid email address"),
  phone: z.string().trim().regex(/^\d{7,15}$/, "Use 7 to 15 numbers only"),
  location: z.string().trim().min(2, "Location is required").max(160),
  consent: z.literal("on", {
    error: "You must accept the applicant privacy notice",
  }),
});
function errors(error: z.ZodError) {
  const result: Record<string, string> = {};
  for (const issue of error.issues)
    result[String(issue.path[0] || "form")] = issue.message;
  return result;
}
function reference(prefix: string) {
  return `${prefix}-${new Date().toISOString().slice(2, 10).replaceAll("-", "")}-${randomUUID().slice(0, 4).toUpperCase()}`;
}

function splitFullName(value: string) {
  const parts = value.trim().split(/\s+/);
  if (parts.length === 1)
    return { firstName: parts[0], middleName: null, lastName: parts[0] };
  return {
    firstName: parts[0],
    middleName: parts.length > 2 ? parts.slice(1, -1).join(" ") : null,
    lastName: parts.at(-1) || parts[0],
  };
}

async function validateResumePdf(file: File) {
  if (file.type !== "application/pdf" || !file.name.toLowerCase().endsWith(".pdf"))
    return "Only PDF resume files are accepted.";
  if (file.size > 4 * 1024 * 1024)
    return "Your PDF must be 4 MB or smaller.";
  if (file.size < 500)
    return "The uploaded PDF is empty or incomplete.";

  const bytes = new Uint8Array(await file.arrayBuffer());
  const signature = new TextDecoder("ascii").decode(bytes.slice(0, 5));
  if (signature !== "%PDF-")
    return "The file is not a valid PDF document.";

  const parser = new PDFParse({ data: bytes });
  try {
    const result = await parser.getText({ first: 6 });
    const text = result.text.toLowerCase().replace(/\s+/g, " ").trim();
    const indicators = [
      /\b(work experience|professional experience|employment history|experience)\b/,
      /\b(education|academic background|qualification)\b/,
      /\b(skills|technical skills|competencies|expertise)\b/,
      /\b(summary|professional profile|career objective|objective)\b/,
      /\b(certifications?|projects?|achievements?|references?)\b/,
    ];
    const matchedSections = indicators.filter((pattern) => pattern.test(text)).length;
    const wordCount = text.split(/\s+/).filter(Boolean).length;
    if (wordCount < 40 || matchedSections < 2)
      return "This PDF does not appear to contain a readable resume. Upload a searchable PDF with sections such as experience, education, or skills.";
  } catch (error) {
    const parserMessage =
      error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    console.error("Resume PDF parsing failed", parserMessage);
    if (/password|encrypted/i.test(parserMessage))
      return "This PDF is password-protected. Upload an unlocked, searchable resume PDF.";
    if (/invalid pdf|invalid.*structure|corrupt|format error/i.test(parserMessage))
      return "This PDF appears damaged or invalid. Export the resume as a new PDF and try again.";
    return "The PDF could not be processed. Export it as a new searchable PDF and try again.";
  } finally {
    await parser.destroy();
  }
  return null;
}

export async function submitPublicApplication(
  _: ApplicationState,
  formData: FormData,
): Promise<ApplicationState> {
  if (String(formData.get("website") || ""))
    return {
      status: "success",
      message: "Your application was received.",
      reference: "APPLICATION-RECEIVED",
    };
  const parsed = applicationSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success)
    return {
      status: "error",
      message: "Please correct the highlighted information.",
      fieldErrors: errors(parsed.error),
    };
  const resume = formData.get("resume");
  if (!(resume instanceof File) || resume.size === 0)
    return {
      status: "error",
      message: "Please attach your resume.",
      fieldErrors: { resume: "Resume is required" },
    };
  const resumeError = await validateResumePdf(resume);
  if (resumeError)
    return {
      status: "error",
      message: "Please upload a valid resume PDF.",
      fieldErrors: { resume: resumeError },
    };
  if (!isAdminConfigured()) {
    const previewReference = reference("APL");
    return {
      status: "success",
      message:
        "Preview application completed. Connect Supabase to save real submissions.",
      reference: previewReference,
    };
  }
  const db = createAdminClient();
  const values = parsed.data;
  const name = splitFullName(values.full_name);
  const { data: vacancy, error: vacancyError } = await db
    .from("job_vacancies")
    .select("id,organization_id,status")
    .eq("id", values.vacancy_id)
    .eq("status", "open")
    .is("deleted_at", null)
    .single();
  if (vacancyError || !vacancy)
    return {
      status: "error",
      message: "This vacancy is no longer accepting applications.",
    };
  let applicantId = "";
  let createdApplicant = false;
  const { data: existing } = await db
    .from("applicants")
    .select("id")
    .eq("organization_id", vacancy.organization_id)
    .ilike("email", values.email)
    .is("deleted_at", null)
    .maybeSingle();
  if (existing) {
    applicantId = existing.id;
    const { data: duplicate } = await db
      .from("job_applications")
      .select("application_number")
      .eq("applicant_id", applicantId)
      .eq("job_vacancy_id", vacancy.id)
      .maybeSingle();
    if (duplicate)
      return {
        status: "error",
        message: `You already applied for this role. Track it using reference ${duplicate.application_number}.`,
      };
    const { error: updateApplicantError } = await db
      .from("applicants")
      .update({
        phone: values.phone,
        city: values.location,
        privacy_consent_at: new Date().toISOString(),
        status: "active",
      })
      .eq("id", applicantId);
    if (updateApplicantError)
      return { status: "error", message: "We could not update your contact information." };
  } else {
    const { data: created, error: createError } = await db
      .from("applicants")
      .insert({
        organization_id: vacancy.organization_id,
        applicant_number: reference("APP"),
        first_name: name.firstName,
        middle_name: name.middleName,
        last_name: name.lastName,
        email: values.email.toLowerCase(),
        phone: values.phone,
        city: values.location,
        source: "Careers page",
        privacy_consent_at: new Date().toISOString(),
        status: "active",
      })
      .select("id")
      .single();
    if (createError || !created)
      return {
        status: "error",
        message:
          createError?.message || "We could not create your applicant profile.",
      };
    applicantId = created.id;
    createdApplicant = true;
  }
  const applicationNumber = reference("APL");
  const { data: stage, error: stageError } = await db
    .from("recruitment_stages")
    .select("id")
    .eq("organization_id", vacancy.organization_id)
    .eq("stage_type", "active")
    .eq("is_active", true)
    .order("stage_order")
    .limit(1)
    .maybeSingle();
  if (stageError || !stage) {
    if (createdApplicant) await db.from("applicants").delete().eq("id", applicantId);
    return {
      status: "error",
      message: "Applications are temporarily unavailable because the recruitment workflow is not configured.",
    };
  }
  const { data: application, error: applicationError } = await db
    .from("job_applications")
    .insert({
      organization_id: vacancy.organization_id,
      application_number: applicationNumber,
      applicant_id: applicantId,
      job_vacancy_id: vacancy.id,
      current_stage_id: stage.id,
      application_status: "in_progress",
    })
    .select("id")
    .single();
  if (applicationError || !application) {
    if (createdApplicant)
      await db.from("applicants").delete().eq("id", applicantId);
    return {
      status: "error",
      message:
        applicationError?.message || "We could not submit your application.",
    };
  }
  const storagePath = `${vacancy.organization_id}/${applicantId}/${application.id}/${randomUUID()}.pdf`;
  const { error: uploadError } = await db.storage
    .from("applicant-documents")
    .upload(storagePath, resume, { contentType: resume.type, upsert: false });
  if (uploadError) {
    await db.from("job_applications").delete().eq("id", application.id);
    if (createdApplicant)
      await db.from("applicants").delete().eq("id", applicantId);
    return {
      status: "error",
      message: "Your resume could not be uploaded. Please try again.",
    };
  }
  const { error: documentError } = await db.from("applicant_documents").insert({
    organization_id: vacancy.organization_id,
    applicant_id: applicantId,
    job_application_id: application.id,
    document_type: "resume",
    title: "Resume / CV",
    storage_path: storagePath,
    file_name: resume.name,
    file_size: resume.size,
    mime_type: resume.type,
    verification_status: "under_review",
    notes: "PDF format and resume structure checks passed; final HR verification is required.",
  });
  if (documentError) {
    await db.storage.from("applicant-documents").remove([storagePath]);
    await db.from("job_applications").delete().eq("id", application.id);
    if (createdApplicant) await db.from("applicants").delete().eq("id", applicantId);
    return {
      status: "error",
      message: "Your resume could not be attached to the application. Please try again.",
    };
  }
  await db.from("application_stage_history").insert({
    job_application_id: application.id,
    to_stage_id: stage.id,
    reason: "Application submitted through careers portal",
  });
  await db.from("audit_logs").insert({
    organization_id: vacancy.organization_id,
    action: "application_submitted",
    entity_type: "job_applications",
    entity_id: application.id,
    metadata: { source: "careers_portal" },
  });
  revalidatePath("/hr/recruitment/applicants");
  revalidatePath("/hr/dashboard");
  return {
    status: "success",
    message: "Your application has been submitted successfully.",
    reference: applicationNumber,
  };
}

export type ProfileCompletionState = {
  status: "idle" | "error" | "success";
  message?: string;
  fieldErrors?: Record<string, string>;
};

const profileCompletionSchema = z
  .object({
    token: z.string().regex(/^[a-f0-9]{64}$/i, "The secure profile link is invalid"),
    alternative_phone: z.union([
      z.string().regex(/^\d{7,15}$/, "Use 7 to 15 numbers only"),
      z.literal(""),
    ]),
    linkedin_url: z.union([z.url("Enter a complete LinkedIn URL"), z.literal("")]),
    current_job_title: z.string().trim().min(2, "Current or most recent role is required").max(160),
    current_employer: z.string().trim().max(160),
    years_experience: z.preprocess((value) => Number(value), z.number().min(0).max(60)),
    expected_salary: z.union([z.string().regex(/^\d+(\.\d{1,2})?$/, "Enter a valid amount"), z.literal("")]),
    availability_date: z.union([z.string().date(), z.literal("")]),
    about: z.string().trim().min(30, "Add at least 30 characters about your professional background").max(3000),
    school: z.string().trim().min(2, "School or university is required").max(200),
    degree: z.string().trim().min(2, "Degree or qualification is required").max(160),
    field_of_study: z.string().trim().min(2, "Field of study is required").max(160),
    education_start: z.union([z.string().date(), z.literal("")]),
    education_end: z.union([z.string().date(), z.literal("")]),
    education_notes: z.string().trim().max(1000),
    experience_company: z.string().trim().max(160),
    experience_position: z.string().trim().max(160),
    employment_type: z.string().trim().max(80),
    experience_start: z.union([z.string().date(), z.literal("")]),
    experience_end: z.union([z.string().date(), z.literal("")]),
    currently_employed: z.preprocess((value) => value === "on", z.boolean()),
    responsibilities: z.string().trim().max(2000),
    achievements: z.string().trim().max(2000),
  })
  .refine(
    (value) =>
      (!value.experience_company && !value.experience_position) ||
      Boolean(value.experience_company && value.experience_position),
    {
      message: "Provide both company and position, or leave both blank",
      path: ["experience_company"],
    },
  );

export async function completeScreenedApplicantProfile(
  _: ProfileCompletionState,
  formData: FormData,
): Promise<ProfileCompletionState> {
  const parsed = profileCompletionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success)
    return {
      status: "error",
      message: "Please complete the highlighted profile information.",
      fieldErrors: errors(parsed.error),
    };
  if (!isAdminConfigured())
    return { status: "error", message: "Applicant profile completion is not configured." };

  const { token, ...profileData } = parsed.data;
  const db = createAdminClient();
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const { data: applicationId, error } = await db.rpc(
    "complete_screened_applicant_profile",
    {
      p_completion_token_hash: tokenHash,
      p_profile_data: profileData,
    },
  );
  if (error)
    return {
      status: "error",
      message: error.message.includes("invalid or has expired")
        ? "This secure profile link is invalid, expired, or has already been used. Contact HR for a new link."
        : error.message,
    };

  revalidatePath("/hr/recruitment/applicants");
  revalidatePath("/hr/dashboard");
  return {
    status: "success",
    message: applicationId
      ? "Your complete profile was submitted securely. HR can now continue the interview process."
      : "Your profile was submitted.",
  };
}

export type TrackingState = {
  status: "idle" | "error" | "success";
  message?: string;
  result?: {
    reference: string;
    position: string;
    stage: string;
    applicationStatus: string;
    profileCompletionStatus: string;
    appliedAt: string;
    notifications: Array<{
      id: string;
      subject: string;
      body: string;
      eventType: string;
      sentAt: string;
    }>;
  };
};
export async function trackApplication(
  _: TrackingState,
  formData: FormData,
): Promise<TrackingState> {
  const referenceValue = String(formData.get("reference") || "")
    .trim()
    .toUpperCase();
  const email = String(formData.get("email") || "")
    .trim()
    .toLowerCase();
  if (!referenceValue || !z.email().safeParse(email).success)
    return {
      status: "error",
      message: "Enter your application reference and email address.",
    };
  if (!isAdminConfigured())
    return {
      status: "success",
      result: {
        reference: referenceValue,
        position: "Product Designer",
        stage: "Recruiter review",
        applicationStatus: "In progress",
        profileCompletionStatus: "not_requested",
        appliedAt: "2026-08-25",
        notifications: [],
      },
    };
  const db = createAdminClient();
  const { data, error } = await db
    .from("job_applications")
    .select(
      "id,application_number,application_status,profile_completion_status,applied_at,applicants!inner(email),job_vacancies(title),recruitment_stages(name)",
    )
    .eq("application_number", referenceValue)
    .ilike("applicants.email", email)
    .maybeSingle();
  if (error || !data)
    return {
      status: "error",
      message: "We couldn’t find an application matching those details.",
    };
  const vacancy = data.job_vacancies as unknown as { title?: string } | null;
  const stage = data.recruitment_stages as unknown as { name?: string } | null;
  const { data: notifications } = await db
    .from("applicant_notifications")
    .select("id,subject,body,event_type,queued_at")
    .eq("job_application_id", data.id)
    .eq("channel", "portal")
    .in("delivery_status", ["sent", "read"])
    .order("queued_at", { ascending: false });
  if (notifications?.length)
    await db
      .from("applicant_notifications")
      .update({ delivery_status: "read", read_at: new Date().toISOString() })
      .in("id", notifications.map((notification) => notification.id));
  return {
    status: "success",
    result: {
      reference: data.application_number,
      position: vacancy?.title || "Position",
      stage: stage?.name || "Application received",
      applicationStatus: data.application_status,
      profileCompletionStatus: data.profile_completion_status,
      appliedAt: data.applied_at,
      notifications: (notifications || []).map((notification) => ({
        id: notification.id,
        subject: notification.subject,
        body: notification.body,
        eventType: notification.event_type,
        sentAt: notification.queued_at,
      })),
    },
  };
}
