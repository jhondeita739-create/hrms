import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";

type Raw = Record<string, unknown>;

export type PreboardingRequirement = {
  id: string;
  title: string;
  description: string | null;
  dueDate: string;
  required: boolean;
  status: string;
  submittedAt: string | null;
  reviewNotes: string | null;
  documentTypeId: string | null;
  documentId: string | null;
  fileName: string | null;
};

export type PreboardingTraining = {
  id: string;
  title: string;
  description: string | null;
  trainingType: string;
  scheduledStart: string;
  scheduledEnd: string;
  timezone: string;
  location: string | null;
  meetingUrl: string | null;
  status: string;
};

export type PreboardingAccount = {
  id: string;
  employeeId: string;
  userId: string;
  applicationId: string | null;
  employeeNumber: string;
  employeeName: string;
  email: string;
  position: string;
  accessStatus: string;
  requirementsDueDate: string;
  invitedAt: string | null;
  permanentAt: string | null;
  requirements: PreboardingRequirement[];
  trainings: PreboardingTraining[];
};

export type HiredApplicationOption = {
  id: string;
  label: string;
  email: string;
};

export type PreboardingAdminData = {
  accounts: PreboardingAccount[];
  hiredApplications: HiredApplicationOption[];
  documentTypes: Array<{ value: string; label: string }>;
};

function name(row: Raw | null | undefined) {
  if (!row) return "New hire";
  return [row.first_name, row.middle_name, row.last_name].filter(Boolean).join(" ");
}

function relation(value: unknown): Raw | null {
  if (Array.isArray(value)) return (value[0] as Raw | undefined) || null;
  return (value as Raw | null) || null;
}

function requirement(row: Raw): PreboardingRequirement {
  const document = relation(row.employee_documents);
  return {
    id: String(row.id),
    title: String(row.title),
    description: row.description ? String(row.description) : null,
    dueDate: String(row.due_date),
    required: Boolean(row.required),
    status: String(row.status),
    submittedAt: row.submitted_at ? String(row.submitted_at) : null,
    reviewNotes: row.review_notes ? String(row.review_notes) : null,
    documentTypeId: row.document_type_id ? String(row.document_type_id) : null,
    documentId: row.employee_document_id ? String(row.employee_document_id) : null,
    fileName: document?.file_name ? String(document.file_name) : null,
  };
}

function training(row: Raw): PreboardingTraining {
  return {
    id: String(row.id),
    title: String(row.title),
    description: row.description ? String(row.description) : null,
    trainingType: String(row.training_type),
    scheduledStart: String(row.scheduled_start),
    scheduledEnd: String(row.scheduled_end),
    timezone: String(row.timezone),
    location: row.location ? String(row.location) : null,
    meetingUrl: row.meeting_url ? String(row.meeting_url) : null,
    status: String(row.status),
  };
}

export async function getPreboardingAdminData(): Promise<PreboardingAdminData> {
  if (!isSupabaseConfigured()) {
    return { accounts: [], hiredApplications: [], documentTypes: [] };
  }
  const db = await createClient();
  const [accountsResult, applicationsResult, documentTypesResult] = await Promise.all([
    db
      .from("employee_account_lifecycle")
      .select(
        "id,employee_id,user_id,job_application_id,access_status,requirements_due_date,invited_at,permanent_at,employees(employee_number,first_name,middle_name,last_name,work_email,employment_records!employment_records_employee_id_fkey(positions(title),is_current),employee_requirement_requests(id,title,description,due_date,required,status,submitted_at,review_notes,document_type_id,employee_document_id,deleted_at,employee_documents(file_name)),employee_training_schedules(id,title,description,training_type,scheduled_start,scheduled_end,timezone,location,meeting_url,status,deleted_at))",
      )
      .order("created_at", { ascending: false }),
    db
      .from("job_applications")
      .select("id,application_number,applicant_id,applicants(first_name,middle_name,last_name,email),job_vacancies(title)")
      .eq("application_status", "hired")
      .order("hired_at", { ascending: false }),
    db
      .from("document_types")
      .select("id,name")
      .eq("status", "active")
      .order("name"),
  ]);
  for (const result of [accountsResult, applicationsResult, documentTypesResult]) {
    if (result.error) throw new Error(result.error.message);
  }

  const rawAccounts = (accountsResult.data || []) as unknown as Raw[];
  const usedApplications = new Set(
    rawAccounts.map((row) => String(row.job_application_id || "")).filter(Boolean),
  );
  const accounts = rawAccounts.map((row) => {
    const employee = relation(row.employees);
    const records = ((employee?.employment_records as Raw[]) || []).filter(
      (record) => record.is_current,
    );
    const position = relation(records[0]?.positions);
    return {
      id: String(row.id),
      employeeId: String(row.employee_id),
      userId: String(row.user_id),
      applicationId: row.job_application_id ? String(row.job_application_id) : null,
      employeeNumber: String(employee?.employee_number || ""),
      employeeName: name(employee),
      email: String(employee?.work_email || ""),
      position: String(position?.title || "Position pending"),
      accessStatus: String(row.access_status),
      requirementsDueDate: String(row.requirements_due_date),
      invitedAt: row.invited_at ? String(row.invited_at) : null,
      permanentAt: row.permanent_at ? String(row.permanent_at) : null,
      requirements: ((employee?.employee_requirement_requests as Raw[]) || [])
        .filter((item) => !item.deleted_at)
        .map(requirement),
      trainings: ((employee?.employee_training_schedules as Raw[]) || [])
        .filter((item) => !item.deleted_at)
        .map(training),
    } satisfies PreboardingAccount;
  });

  const hiredApplications = ((applicationsResult.data || []) as unknown as Raw[])
    .filter((row) => !usedApplications.has(String(row.id)))
    .map((row) => {
      const applicant = relation(row.applicants);
      const vacancy = relation(row.job_vacancies);
      return {
        id: String(row.id),
        label: `${name(applicant)} — ${String(vacancy?.title || "Hired role")}`,
        email: String(applicant?.email || ""),
      };
    });

  return {
    accounts,
    hiredApplications,
    documentTypes: (documentTypesResult.data || []).map((item) => ({
      value: item.id,
      label: item.name,
    })),
  };
}

export type EmployeeOnboardingData = {
  account: PreboardingAccount;
  onboardingProgress: number;
  tasks: Array<{ id: string; title: string; category: string; dueDate: string | null; status: string }>;
  notifications: Array<{ id: string; title: string; body: string; createdAt: string; status: string }>;
};

export async function getEmployeeOnboardingData(): Promise<EmployeeOnboardingData | null> {
  if (!isSupabaseConfigured()) return null;
  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return null;
  const { data: lifecycle, error } = await db
    .from("employee_account_lifecycle")
    .select("id,employee_id,user_id,job_application_id,access_status,requirements_due_date,invited_at,permanent_at,employees(employee_number,first_name,middle_name,last_name,work_email,employment_records!employment_records_employee_id_fkey(positions(title),is_current))")
    .eq("user_id", user.id)
    .maybeSingle();
  if (error || !lifecycle) return null;

  const [requirementsResult, trainingsResult, onboardingResult, notificationsResult] =
    await Promise.all([
      db
        .from("employee_requirement_requests")
        .select("id,title,description,due_date,required,status,submitted_at,review_notes,document_type_id,employee_document_id,employee_documents(file_name)")
        .eq("employee_id", lifecycle.employee_id)
        .is("deleted_at", null)
        .order("due_date"),
      db
        .from("employee_training_schedules")
        .select("id,title,description,training_type,scheduled_start,scheduled_end,timezone,location,meeting_url,status")
        .eq("employee_id", lifecycle.employee_id)
        .is("deleted_at", null)
        .order("scheduled_start"),
      db
        .from("employee_onboarding")
        .select("id,onboarding_tasks(id,title,category,due_date,status)")
        .eq("employee_id", lifecycle.employee_id)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      db
        .from("notifications")
        .select("id,title,body,created_at,status")
        .eq("recipient_id", user.id)
        .order("created_at", { ascending: false })
        .limit(10),
    ]);
  for (const result of [requirementsResult, trainingsResult, onboardingResult, notificationsResult]) {
    if (result.error) throw new Error(result.error.message);
  }
  const employee = relation(lifecycle.employees);
  const records = ((employee?.employment_records as Raw[]) || []).filter(
    (record) => record.is_current,
  );
  const position = relation(records[0]?.positions);
  const requirements = ((requirementsResult.data || []) as unknown as Raw[]).map(requirement);
  const trainings = ((trainingsResult.data || []) as unknown as Raw[]).map(training);
  const taskRows = ((onboardingResult.data?.onboarding_tasks || []) as unknown as Raw[]);
  const completed = taskRows.filter((task) => task.status === "completed").length;

  return {
    account: {
      id: lifecycle.id,
      employeeId: lifecycle.employee_id,
      userId: lifecycle.user_id,
      applicationId: lifecycle.job_application_id,
      employeeNumber: String(employee?.employee_number || ""),
      employeeName: name(employee),
      email: String(employee?.work_email || user.email || ""),
      position: String(position?.title || "New employee"),
      accessStatus: lifecycle.access_status,
      requirementsDueDate: lifecycle.requirements_due_date,
      invitedAt: lifecycle.invited_at,
      permanentAt: lifecycle.permanent_at,
      requirements,
      trainings,
    },
    onboardingProgress: taskRows.length ? Math.round((completed / taskRows.length) * 100) : 0,
    tasks: taskRows.map((task) => ({
      id: String(task.id),
      title: String(task.title),
      category: String(task.category),
      dueDate: task.due_date ? String(task.due_date) : null,
      status: String(task.status),
    })),
    notifications: (notificationsResult.data || []).map((item) => ({
      id: item.id,
      title: item.title,
      body: item.body,
      createdAt: item.created_at,
      status: item.status,
    })),
  };
}
