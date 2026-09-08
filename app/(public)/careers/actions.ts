"use server";

import { randomUUID } from "node:crypto";
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

type ResumeCheck = { error: string | null; extractedText: string };

async function validateResumePdf(file: File): Promise<ResumeCheck> {
  if (file.type !== "application/pdf" || !file.name.toLowerCase().endsWith(".pdf"))
    return { error: "Only PDF resume files are accepted.", extractedText: "" };
  if (file.size > 4 * 1024 * 1024)
    return { error: "Your PDF must be 4 MB or smaller.", extractedText: "" };
  if (file.size < 500)
    return { error: "The uploaded PDF is empty or incomplete.", extractedText: "" };

  const bytes = new Uint8Array(await file.arrayBuffer());
  const signature = new TextDecoder("ascii").decode(bytes.slice(0, 5));
  if (signature !== "%PDF-")
    return { error: "The file is not a valid PDF document.", extractedText: "" };

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
      return {
        error: "This PDF does not appear to contain a readable resume. Upload a searchable PDF with sections such as experience, education, or skills.",
        extractedText: "",
      };
    return { error: null, extractedText: result.text.slice(0, 50_000) };
  } catch (error) {
    const parserMessage =
      error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    console.error("Resume PDF parsing failed", parserMessage);
    if (/password|encrypted/i.test(parserMessage))
      return { error: "This PDF is password-protected. Upload an unlocked, searchable resume PDF.", extractedText: "" };
    if (/invalid pdf|invalid.*structure|corrupt|format error/i.test(parserMessage))
      return { error: "This PDF appears damaged or invalid. Export the resume as a new PDF and try again.", extractedText: "" };
    return { error: "The PDF could not be processed. Export it as a new searchable PDF and try again.", extractedText: "" };
  } finally {
    await parser.destroy();
  }
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
  const resumeCheck = await validateResumePdf(resume);
  if (resumeCheck.error)
    return {
      status: "error",
      message: "Please upload a valid resume PDF.",
      fieldErrors: { resume: resumeCheck.error },
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
    extracted_text: resumeCheck.extractedText,
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

export type TrackingState = {
  status: "idle" | "error" | "success";
  message?: string;
  result?: {
    reference: string;
    position: string;
    stage: string;
    applicationStatus: string;
    appliedAt: string;
    resume: {
      fileName: string;
      verificationStatus: string;
    } | null;
    interview: {
      type: string;
      scheduledStart: string;
      scheduledEnd: string;
      timezone: string;
      location: string | null;
      meetingUrl: string | null;
      status: string;
    } | null;
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
        appliedAt: "2026-08-25",
        resume: {
          fileName: "candidate-resume.pdf",
          verificationStatus: "verified",
        },
        interview: null,
        notifications: [],
      },
    };
  const db = createAdminClient();
  const { data, error } = await db
    .from("job_applications")
    .select(
      "id,application_number,application_status,applied_at,applicants!inner(email),job_vacancies(title),recruitment_stages(name)",
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
  const [{ data: notifications }, { data: resume }, { data: interview }] =
    await Promise.all([
      db
        .from("applicant_notifications")
        .select("id,subject,body,event_type,queued_at")
        .eq("job_application_id", data.id)
        .eq("channel", "portal")
        .in("delivery_status", ["sent", "read"])
        .order("queued_at", { ascending: false }),
      db
        .from("applicant_documents")
        .select("file_name,verification_status")
        .eq("job_application_id", data.id)
        .eq("document_type", "resume")
        .is("deleted_at", null)
        .order("uploaded_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      db
        .from("interviews")
        .select("interview_type,scheduled_start,scheduled_end,timezone,location,meeting_url,status")
        .eq("job_application_id", data.id)
        .neq("status", "cancelled")
        .order("scheduled_start", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
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
      appliedAt: data.applied_at,
      resume: resume
        ? {
            fileName: resume.file_name,
            verificationStatus: resume.verification_status,
          }
        : null,
      interview: interview
        ? {
            type: interview.interview_type,
            scheduledStart: interview.scheduled_start,
            scheduledEnd: interview.scheduled_end,
            timezone: interview.timezone,
            location: interview.location,
            meetingUrl: interview.meeting_url,
            status: interview.status,
          }
        : null,
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
