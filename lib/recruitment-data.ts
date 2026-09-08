import { demoData } from "@/lib/demo-data";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";

type Raw = Record<string, unknown>;

export type ApplicantDocumentRecord = {
  id: string;
  applicationId: string | null;
  type: string;
  title: string;
  fileName: string;
  fileSize: number | null;
  verificationStatus: string;
  notes: string | null;
  uploadedAt: string;
};

export type ApplicantInterviewRecord = {
  id: string;
  applicationId: string;
  type: string;
  scheduledStart: string;
  scheduledEnd: string;
  timezone: string;
  location: string | null;
  meetingUrl: string | null;
  instructions: string | null;
  status: string;
  evaluations: Array<{
    id: string;
    recommendation: string;
    comments: string | null;
    submittedAt: string | null;
  }>;
};

export type ApplicantAiAssessment = {
  id: string;
  score: number;
  recommendation: string;
  summary: string;
  strengths: string[];
  concerns: string[];
  modelName: string;
  modelVersion: string;
  generatedAt: string;
  reviewDecision: string | null;
  reviewNotes: string | null;
};

export type ApplicantNotificationRecord = {
  id: string;
  applicationId: string | null;
  eventType: string;
  channel: string;
  subject: string;
  body: string;
  deliveryStatus: string;
  queuedAt: string;
};

export type ApplicantReviewApplication = {
  id: string;
  applicationNumber: string;
  position: string;
  stageId: string | null;
  stage: string;
  applicationStatus: string;
  appliedAt: string;
  rating: number;
  coverLetter: string | null;
  finalResult: string | null;
  rejectionReason: string | null;
  assessment: ApplicantAiAssessment | null;
  interviews: ApplicantInterviewRecord[];
  notifications: ApplicantNotificationRecord[];
};

export type ApplicantReviewData = {
  applicant: {
    id: string;
    number: string;
    name: string;
    email: string;
    phone: string;
    alternativePhone: string | null;
    city: string | null;
    region: string | null;
    currentJobTitle: string | null;
    currentEmployer: string | null;
    yearsExperience: number;
    linkedinUrl: string | null;
    expectedSalary: number | null;
    availabilityDate: string | null;
    status: string;
  };
  applications: ApplicantReviewApplication[];
  documents: ApplicantDocumentRecord[];
  stages: Array<{ id: string; name: string; type: string }>;
};

function fullName(row: Raw) {
  return [row.first_name, row.middle_name, row.last_name]
    .filter(Boolean)
    .join(" ");
}

export async function getApplicantReviewData(
  applicantId: string,
): Promise<ApplicantReviewData | null> {
  if (!isSupabaseConfigured()) {
    const preview =
      demoData.applicants.find((item) => item.id === applicantId) ||
      demoData.applicants[0];
    if (!preview) return null;
    return {
      applicant: {
        id: preview.id,
        number: String(preview.applicant_number),
        name: String(preview.name),
        email: String(preview.email),
        phone: String(preview.phone),
        alternativePhone: null,
        city: "Manila",
        region: "Metro Manila",
        currentJobTitle: String(preview.current_job_title || ""),
        currentEmployer: "Current employer",
        yearsExperience: 4,
        linkedinUrl: null,
        expectedSalary: null,
        availabilityDate: null,
        status: String(preview.status),
      },
      applications: [
        {
          id: preview.id,
          applicationNumber: String(preview.applicant_number).replace("APP", "APL"),
          position: String(preview.current_job_title || "Open role"),
          stageId: "preview-interview",
          stage: String(preview.stage),
          applicationStatus: "in_progress",
          appliedAt: String(preview.created_at),
          rating: Number(preview.rating || 0),
          coverLetter: "I am interested in contributing my experience to this role.",
          finalResult: null,
          rejectionReason: null,
          assessment: null,
          interviews: [],
          notifications: [],
        },
      ],
      documents: [
        {
          id: "preview-document",
          applicationId: preview.id,
          type: "resume",
          title: "Resume / CV",
          fileName: "candidate-resume.pdf",
          fileSize: 248000,
          verificationStatus: "submitted",
          notes: null,
          uploadedAt: String(preview.created_at),
        },
      ],
      stages: [
        { id: "preview-applied", name: "Applied", type: "active" },
        { id: "preview-screening", name: "Screening", type: "active" },
        { id: "preview-interview", name: "HR Interview", type: "active" },
        { id: "preview-hired", name: "Hired", type: "hired" },
        { id: "preview-rejected", name: "Rejected", type: "rejected" },
      ],
    };
  }

  const db = await createClient();
  const { data: applicant, error: applicantError } = await db
    .from("applicants")
    .select(
      "id,organization_id,applicant_number,first_name,middle_name,last_name,email,phone,alternative_phone,city,region,linkedin_url,current_job_title,current_employer,years_experience,expected_salary,availability_date,status",
    )
    .eq("id", applicantId)
    .is("deleted_at", null)
    .maybeSingle();
  if (applicantError) throw new Error(applicantError.message);
  if (!applicant) return null;

  const { data: applications, error: applicationsError } = await db
    .from("job_applications")
    .select(
      "id,application_number,current_stage_id,application_status,applied_at,rating,cover_letter,final_result,rejection_reason,job_vacancies(title),recruitment_stages(name)",
    )
    .eq("applicant_id", applicantId)
    .order("applied_at", { ascending: false });
  if (applicationsError) throw new Error(applicationsError.message);
  const applicationIds = (applications || []).map((item) => item.id);

  const [
    documentsResult,
    stagesResult,
    interviewsResult,
    assessmentsResult,
    notificationsResult,
  ] =
    await Promise.all([
      db
        .from("applicant_documents")
        .select("id,job_application_id,document_type,title,file_name,file_size,verification_status,notes,uploaded_at")
        .eq("applicant_id", applicantId)
        .is("deleted_at", null)
        .order("uploaded_at", { ascending: false }),
      db
        .from("recruitment_stages")
        .select("id,name,stage_type")
        .eq("organization_id", applicant.organization_id)
        .eq("is_active", true)
        .order("stage_order"),
      applicationIds.length
        ? db
            .from("interviews")
            .select("id,job_application_id,interview_type,scheduled_start,scheduled_end,timezone,location,meeting_url,instructions,status,interview_evaluations(id,recommendation,comments,submitted_at)")
            .in("job_application_id", applicationIds)
            .order("scheduled_start", { ascending: false })
        : Promise.resolve({ data: [], error: null }),
      applicationIds.length
        ? db
            .from("applicant_ai_assessments")
            .select("id,job_application_id,score,recommendation,summary,strengths,concerns,model_name,model_version,generated_at,review_decision,review_notes")
            .in("job_application_id", applicationIds)
        : Promise.resolve({ data: [], error: null }),
      applicationIds.length
        ? db
            .from("applicant_notifications")
            .select("id,job_application_id,event_type,channel,subject,body,delivery_status,queued_at")
            .in("job_application_id", applicationIds)
            .order("queued_at", { ascending: false })
        : Promise.resolve({ data: [], error: null }),
    ]);

  for (const result of [
    documentsResult,
    stagesResult,
    interviewsResult,
    assessmentsResult,
    notificationsResult,
  ]) {
    if (result.error) throw new Error(result.error.message);
  }

  const interviews = (interviewsResult.data || []) as Raw[];
  const assessments = (assessmentsResult.data || []) as Raw[];
  const notifications = (notificationsResult.data || []) as Raw[];

  return {
    applicant: {
      id: applicant.id,
      number: applicant.applicant_number,
      name: fullName(applicant as unknown as Raw),
      email: applicant.email,
      phone: applicant.phone,
      alternativePhone: applicant.alternative_phone,
      city: applicant.city,
      region: applicant.region,
      currentJobTitle: applicant.current_job_title,
      currentEmployer: applicant.current_employer,
      yearsExperience: Number(applicant.years_experience || 0),
      linkedinUrl: applicant.linkedin_url,
      expectedSalary: applicant.expected_salary == null ? null : Number(applicant.expected_salary),
      availabilityDate: applicant.availability_date,
      status: applicant.status,
    },
    applications: ((applications || []) as unknown as Raw[]).map((application) => {
      const vacancy = application.job_vacancies as Raw | null;
      const stage = application.recruitment_stages as Raw | null;
      const assessment = assessments.find(
        (item) => item.job_application_id === application.id,
      );
      return {
        id: String(application.id),
        applicationNumber: String(application.application_number),
        position: String(vacancy?.title || "Open role"),
        stageId: application.current_stage_id
          ? String(application.current_stage_id)
          : null,
        stage: String(stage?.name || "Application received"),
        applicationStatus: String(application.application_status),
        appliedAt: String(application.applied_at),
        rating: Number(application.rating || 0),
        coverLetter: application.cover_letter
          ? String(application.cover_letter)
          : null,
        finalResult: application.final_result
          ? String(application.final_result)
          : null,
        rejectionReason: application.rejection_reason
          ? String(application.rejection_reason)
          : null,
        assessment: assessment
          ? {
              id: String(assessment.id),
              score: Number(assessment.score),
              recommendation: String(assessment.recommendation),
              summary: String(assessment.summary),
              strengths: (assessment.strengths as string[]) || [],
              concerns: (assessment.concerns as string[]) || [],
              modelName: String(assessment.model_name),
              modelVersion: String(assessment.model_version),
              generatedAt: String(assessment.generated_at),
              reviewDecision: assessment.review_decision
                ? String(assessment.review_decision)
                : null,
              reviewNotes: assessment.review_notes
                ? String(assessment.review_notes)
                : null,
            }
          : null,
        interviews: interviews
          .filter((item) => item.job_application_id === application.id)
          .map((item) => ({
            id: String(item.id),
            applicationId: String(item.job_application_id),
            type: String(item.interview_type),
            scheduledStart: String(item.scheduled_start),
            scheduledEnd: String(item.scheduled_end),
            timezone: String(item.timezone),
            location: item.location ? String(item.location) : null,
            meetingUrl: item.meeting_url ? String(item.meeting_url) : null,
            instructions: item.instructions ? String(item.instructions) : null,
            status: String(item.status),
            evaluations: ((item.interview_evaluations as Raw[]) || []).map(
              (evaluation) => ({
                id: String(evaluation.id),
                recommendation: String(evaluation.recommendation),
                comments: evaluation.comments
                  ? String(evaluation.comments)
                  : null,
                submittedAt: evaluation.submitted_at
                  ? String(evaluation.submitted_at)
                  : null,
              }),
            ),
          })),
        notifications: notifications
          .filter((item) => item.job_application_id === application.id)
          .map((item) => ({
            id: String(item.id),
            applicationId: item.job_application_id
              ? String(item.job_application_id)
              : null,
            eventType: String(item.event_type),
            channel: String(item.channel),
            subject: String(item.subject),
            body: String(item.body),
            deliveryStatus: String(item.delivery_status),
            queuedAt: String(item.queued_at),
          })),
      };
    }),
    documents: ((documentsResult.data || []) as Raw[]).map((document) => ({
      id: String(document.id),
      applicationId: document.job_application_id
        ? String(document.job_application_id)
        : null,
      type: String(document.document_type),
      title: String(document.title),
      fileName: String(document.file_name),
      fileSize: document.file_size == null ? null : Number(document.file_size),
      verificationStatus: String(document.verification_status),
      notes: document.notes ? String(document.notes) : null,
      uploadedAt: String(document.uploaded_at),
    })),
    stages: ((stagesResult.data || []) as Raw[]).map((stage) => ({
      id: String(stage.id),
      name: String(stage.name),
      type: String(stage.stage_type),
    })),
  };
}
