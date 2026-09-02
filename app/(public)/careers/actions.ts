"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";

export type ApplicationState = {
  status: "idle" | "error" | "success";
  message?: string;
  reference?: string;
  fieldErrors?: Record<string, string>;
};
export const initialApplicationState: ApplicationState = { status: "idle" };
const optional = (value: unknown) => String(value || "").trim() || null;
const applicationSchema = z.object({
  vacancy_id: z.string().min(1),
  first_name: z.string().trim().min(1, "First name is required"),
  last_name: z.string().trim().min(1, "Last name is required"),
  email: z.email("Enter a valid email address"),
  phone: z.string().trim().min(7, "Enter a valid phone number"),
  city: z.string().trim().min(2, "City is required"),
  region: z.string().trim().min(2, "Province or region is required"),
  linkedin_url: z
    .union([z.url("Enter a complete URL"), z.literal("")])
    .optional(),
  current_job_title: z.string().optional(),
  current_employer: z.string().optional(),
  years_experience: z.preprocess(
    (value) => Number(value || 0),
    z.number().min(0).max(60),
  ),
  expected_salary: z.preprocess(
    (value) => (value ? Number(value) : null),
    z.number().nonnegative().nullable(),
  ),
  availability_date: z.string().optional(),
  school: z.string().optional(),
  degree: z.string().optional(),
  field_of_study: z.string().optional(),
  experience_company: z.string().optional(),
  experience_position: z.string().optional(),
  experience_start: z.string().optional(),
  experience_end: z.string().optional(),
  cover_letter: z.string().trim().max(5000).optional(),
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
  const allowed = new Set([
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ]);
  if (!allowed.has(resume.type))
    return {
      status: "error",
      message: "Your resume must be a PDF, DOC, or DOCX file.",
      fieldErrors: { resume: "Unsupported file type" },
    };
  if (resume.size > 5 * 1024 * 1024)
    return {
      status: "error",
      message: "Your resume must be smaller than 5 MB.",
      fieldErrors: { resume: "File is too large" },
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
    await db
      .from("applicants")
      .update({
        phone: values.phone,
        city: values.city,
        region: values.region,
        linkedin_url: optional(values.linkedin_url),
        current_job_title: optional(values.current_job_title),
        current_employer: optional(values.current_employer),
        years_experience: values.years_experience,
        expected_salary: values.expected_salary,
        availability_date: optional(values.availability_date),
        privacy_consent_at: new Date().toISOString(),
        status: "active",
      })
      .eq("id", applicantId);
  } else {
    const { data: created, error: createError } = await db
      .from("applicants")
      .insert({
        organization_id: vacancy.organization_id,
        applicant_number: reference("APP"),
        first_name: values.first_name,
        last_name: values.last_name,
        email: values.email.toLowerCase(),
        phone: values.phone,
        city: values.city,
        region: values.region,
        linkedin_url: optional(values.linkedin_url),
        current_job_title: optional(values.current_job_title),
        current_employer: optional(values.current_employer),
        years_experience: values.years_experience,
        expected_salary: values.expected_salary,
        availability_date: optional(values.availability_date),
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
  const { data: stage } = await db
    .from("recruitment_stages")
    .select("id")
    .eq("organization_id", vacancy.organization_id)
    .eq("stage_type", "active")
    .eq("is_active", true)
    .order("stage_order")
    .limit(1)
    .maybeSingle();
  const { data: application, error: applicationError } = await db
    .from("job_applications")
    .insert({
      organization_id: vacancy.organization_id,
      application_number: applicationNumber,
      applicant_id: applicantId,
      job_vacancy_id: vacancy.id,
      current_stage_id: stage?.id,
      application_status: "in_progress",
      cover_letter: optional(values.cover_letter),
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
  if (values.school)
    await db.from("applicant_education").insert({
      applicant_id: applicantId,
      school: values.school,
      degree: optional(values.degree),
      field_of_study: optional(values.field_of_study),
    });
  if (values.experience_company && values.experience_position)
    await db.from("applicant_experience").insert({
      applicant_id: applicantId,
      company: values.experience_company,
      position: values.experience_position,
      start_date: optional(values.experience_start),
      end_date: optional(values.experience_end),
      currently_employed: !values.experience_end,
    });
  const extension =
    resume.name
      .split(".")
      .pop()
      ?.toLowerCase()
      .replace(/[^a-z0-9]/g, "") || "pdf";
  const storagePath = `${vacancy.organization_id}/${applicantId}/${application.id}/${randomUUID()}.${extension}`;
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
  await db.from("applicant_documents").insert({
    organization_id: vacancy.organization_id,
    applicant_id: applicantId,
    job_application_id: application.id,
    document_type: "resume",
    title: "Resume / CV",
    storage_path: storagePath,
    file_name: resume.name,
    file_size: resume.size,
    mime_type: resume.type,
    verification_status: "submitted",
  });
  await db.from("application_stage_history").insert({
    job_application_id: application.id,
    to_stage_id: stage?.id,
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
  };
};
export const initialTrackingState: TrackingState = { status: "idle" };
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
      },
    };
  const db = createAdminClient();
  const { data, error } = await db
    .from("job_applications")
    .select(
      "application_number,application_status,applied_at,applicants!inner(email),job_vacancies(title),recruitment_stages(name)",
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
  return {
    status: "success",
    result: {
      reference: data.application_number,
      position: vacancy?.title || "Position",
      stage: stage?.name || "Application received",
      applicationStatus: data.application_status,
      appliedAt: data.applied_at,
    },
  };
}
