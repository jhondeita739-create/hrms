import { demoData } from "@/lib/demo-data";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import type { EntityKey, FieldOption, ResourceRecord } from "@/types/resources";

type Raw = Record<string, unknown>;
const name = (row: Raw) =>
  [row.first_name, row.middle_name, row.last_name].filter(Boolean).join(" ");

export async function getResource(
  entity: EntityKey,
): Promise<ResourceRecord[]> {
  if (!isSupabaseConfigured()) return demoData[entity];
  const db = await createClient();
  if (entity === "departments") {
    const { data, error } = await db
      .from("departments")
      .select(
        "id,name,code,status,created_at,manager_id,profiles(full_name),employment_records(count)",
      )
      .order("name");
    if (error) throw new Error(error.message);
    return (data as Raw[]).map(
      (r) =>
        ({
          ...r,
          manager: String((r.profiles as Raw)?.full_name || "Unassigned"),
          people: Number((r.employment_records as Raw[])?.[0]?.count || 0),
          profiles: undefined,
          employment_records: undefined,
        }) as unknown as ResourceRecord,
    );
  }
  if (entity === "applicants") {
    const { data, error } = await db
      .from("applicants")
      .select(
        "id,applicant_number,first_name,middle_name,last_name,email,phone,current_job_title,current_employer,years_experience,source,status,created_at,job_applications(application_status,applied_at,rating,recruitment_stages(name),applicant_ai_assessments(score,recommendation))",
      )
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data as Raw[]).map((r) => {
      const apps = r.job_applications as Raw[] | undefined;
      const app = apps?.sort((a, b) =>
        String(b.applied_at || "").localeCompare(String(a.applied_at || "")),
      )[0];
      const stage = app?.recruitment_stages as Raw | undefined;
      const assessmentValue = app?.applicant_ai_assessments as
        | Raw
        | Raw[]
        | undefined;
      const assessment = Array.isArray(assessmentValue)
        ? assessmentValue[0]
        : assessmentValue;
      return {
        ...r,
        name: name(r),
        stage: String(stage?.name || "No application"),
        application_status: String(app?.application_status || "no_application"),
        rating: Number(app?.rating || 0),
        ai_score: assessment ? Number(assessment.score) : null,
        ai_recommendation: String(assessment?.recommendation || "not_assessed"),
        job_applications: undefined,
      } as unknown as ResourceRecord;
    });
  }
  if (entity === "vacancies") {
    const { data, error } = await db
      .from("job_vacancies")
      .select(
        "id,vacancy_number,title,department_id,departments(name),employment_type,work_arrangement,number_of_openings,closing_date,status,description,salary_min,salary_max,currency,job_applications(count)",
      )
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data as Raw[]).map(
      (r) =>
        ({
          ...r,
          department: String((r.departments as Raw)?.name || "Unassigned"),
          applicants: Number((r.job_applications as Raw[])?.[0]?.count || 0),
          departments: undefined,
          job_applications: undefined,
        }) as unknown as ResourceRecord,
    );
  }
  if (entity === "employees") {
    const { data, error } = await db
      .from("employees")
      .select(
        "id,employee_number,first_name,middle_name,last_name,work_email,personal_email,phone,hire_date,employment_status,employment_records!employment_records_employee_id_fkey(id,department_id,employment_type,work_arrangement,departments(name),positions(title),is_current)",
      )
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data as Raw[]).map((r) => {
      const records = (r.employment_records as Raw[])?.filter(
        (x) => x.is_current,
      );
      const current = records?.[0];
      return {
        ...r,
        name: name(r),
        department: String((current?.departments as Raw)?.name || "Unassigned"),
        department_id: String(current?.department_id || ""),
        position: String((current?.positions as Raw)?.title || "Unassigned"),
        employment_type: String(current?.employment_type || "Full-time"),
        work_arrangement: String(current?.work_arrangement || "On-site"),
        employment_records: undefined,
      } as unknown as ResourceRecord;
    });
  }
  if (entity === "onboarding") {
    const { data, error } = await db
      .from("employee_onboarding")
      .select(
        "id,employee_id,start_date,status,employees(first_name,middle_name,last_name,employment_records!employment_records_employee_id_fkey(departments(name),positions(title),is_current)),profiles!employee_onboarding_owner_id_fkey(full_name),onboarding_tasks(status)",
      )
      .is("deleted_at", null)
      .order("start_date");
    if (error) throw new Error(error.message);
    return (data as Raw[]).map((r) => {
      const employee = r.employees as Raw;
      const current = ((employee?.employment_records as Raw[]) || []).find(
        (x) => x.is_current,
      );
      const tasks = (r.onboarding_tasks as Raw[]) || [];
      const done = tasks.filter((x) => x.status === "completed").length;
      return {
        ...r,
        employee: name(employee),
        owner: String((r.profiles as Raw)?.full_name || "Unassigned"),
        department: String((current?.departments as Raw)?.name || "Unassigned"),
        position: String((current?.positions as Raw)?.title || "Unassigned"),
        progress: tasks.length ? Math.round((done / tasks.length) * 100) : 0,
        pending: tasks.length - done,
        employees: undefined,
        profiles: undefined,
        onboarding_tasks: undefined,
      } as unknown as ResourceRecord;
    });
  }
  const { data, error } = await db
    .from("employee_documents")
    .select(
      "id,employee_id,document_type_id,title,document_number,issued_date,expiration_date,verification_status,confidentiality_level,status,file_name,employees(first_name,middle_name,last_name),document_types(name)",
    )
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data as Raw[]).map(
    (r) =>
      ({
        ...r,
        employee: name(r.employees as Raw),
        document_type: String((r.document_types as Raw)?.name || "Other"),
        employees: undefined,
        document_types: undefined,
      }) as unknown as ResourceRecord,
  );
}

export async function getOptions(
  kind: "departments" | "employees" | "document_types" | "vacancies",
): Promise<FieldOption[]> {
  if (!isSupabaseConfigured()) {
    if (kind === "departments")
      return ["People & Culture", "Finance", "Technology", "Operations"].map(
        (x, i) => ({
          label: x,
          value: `10000000-0000-0000-0000-00000000000${i + 1}`,
        }),
      );
    if (kind === "employees")
      return demoData.employees.map((x) => ({
        label: String(x.name),
        value: x.id,
      }));
    if (kind === "vacancies")
      return demoData.vacancies.map((x) => ({
        label: String(x.title),
        value: x.id,
      }));
    return [
      "Employment Contract",
      "Government ID",
      "Certification",
      "Training Certificate",
      "Other",
    ].map((x) => ({ label: x, value: x.toLowerCase().replaceAll(" ", "-") }));
  }
  const db = await createClient();
  if (kind === "departments") {
    const { data } = await db
      .from("departments")
      .select("id,name")
      .eq("status", "active")
      .order("name");
    return (data || []).map((x) => ({ label: x.name, value: x.id }));
  }
  if (kind === "employees") {
    const { data } = await db
      .from("employees")
      .select("id,first_name,last_name,employee_number")
      .is("deleted_at", null)
      .order("last_name");
    return (data || []).map((x) => ({
      label: `${x.first_name} ${x.last_name} · ${x.employee_number}`,
      value: x.id,
    }));
  }
  if (kind === "vacancies") {
    const { data } = await db
      .from("job_vacancies")
      .select("id,title,vacancy_number")
      .in("status", ["open", "draft"])
      .is("deleted_at", null)
      .order("title");
    return (data || []).map((x) => ({
      label: `${x.title} · ${x.vacancy_number}`,
      value: x.id,
    }));
  }
  const { data } = await db
    .from("document_types")
    .select("id,name")
    .eq("status", "active")
    .order("name");
  return (data || []).map((x) => ({ label: x.name, value: x.id }));
}

export async function getDashboardData() {
  if (!isSupabaseConfigured())
    return {
      employees: 1284,
      applicants: 86,
      vacancies: 14,
      onboarding: 9,
      pendingRequests: 7,
      expiringDocuments: 12,
    };
  const db = await createClient();
  const today = new Date().toISOString().slice(0, 10);
  const soon = new Date(Date.now() + 60 * 86400000).toISOString().slice(0, 10);
  const [employees, applicants, vacancies, onboarding, requests, documents] =
    await Promise.all([
      db
        .from("employees")
        .select("id", { count: "exact", head: true })
        .eq("employment_status", "active")
        .is("deleted_at", null),
      db
        .from("applicants")
        .select("id", { count: "exact", head: true })
        .eq("status", "active")
        .is("deleted_at", null),
      db
        .from("job_vacancies")
        .select("id", { count: "exact", head: true })
        .eq("status", "open")
        .is("deleted_at", null),
      db
        .from("employee_onboarding")
        .select("id", { count: "exact", head: true })
        .in("status", ["not_started", "in_progress"])
        .is("deleted_at", null),
      db
        .from("hr_requests")
        .select("id", { count: "exact", head: true })
        .in("status", ["submitted", "under_review"]),
      db
        .from("employee_documents")
        .select("id", { count: "exact", head: true })
        .gte("expiration_date", today)
        .lte("expiration_date", soon)
        .is("deleted_at", null),
    ]);
  return {
    employees: employees.count || 0,
    applicants: applicants.count || 0,
    vacancies: vacancies.count || 0,
    onboarding: onboarding.count || 0,
    pendingRequests: requests.count || 0,
    expiringDocuments: documents.count || 0,
  };
}

export type DashboardAnalytics = {
  trend: Array<{ month: string; applications: number; hires: number }>;
  pipeline: Array<{ stage: string; candidates: number }>;
  departments: Array<{ name: string; value: number }>;
};

export type ApplicantBoardColumn = "new" | "interviewing" | "hired";

export type ApplicantBoardItem = {
  id: string;
  applicantId: string;
  name: string;
  role: string;
  department: string;
  rating: number;
  daysInStage: number;
  column: ApplicantBoardColumn;
};

export type OnboardingChecklistItem = {
  id: string;
  title: string;
  category: string;
  completed: boolean;
};

export type DashboardOnboarding = {
  id: string;
  employee: string;
  position: string;
  startDate: string;
  tasks: OnboardingChecklistItem[];
} | null;

function boardColumn(stageName: string): ApplicantBoardColumn {
  const stage = stageName.toLowerCase();
  if (stage === "hired") return "hired";
  if (
    stage.includes("interview") ||
    stage.includes("assessment") ||
    stage.includes("offer")
  )
    return "interviewing";
  return "new";
}

function elapsedDays(value: unknown) {
  const timestamp = new Date(String(value || Date.now())).getTime();
  if (Number.isNaN(timestamp)) return 0;
  return Math.max(0, Math.floor((Date.now() - timestamp) / 86_400_000));
}

export async function getDashboardApplicantBoard(): Promise<
  ApplicantBoardItem[]
> {
  if (!isSupabaseConfigured()) {
    const columns: ApplicantBoardColumn[] = [
      "new",
      "new",
      "interviewing",
      "interviewing",
      "hired",
    ];
    const departments = [
      "Finance",
      "Technology",
      "People & Culture",
      "Technology",
      "Finance",
    ];
    return demoData.applicants.map((applicant, index) => ({
      id: applicant.id,
      applicantId: applicant.id,
      name: String(applicant.name),
      role: String(applicant.current_job_title || "Open role"),
      department: departments[index] || "Unassigned",
      rating: Number(applicant.rating || 0),
      daysInStage: Math.max(1, elapsedDays(applicant.created_at) - index),
      column: columns[index] || "new",
    }));
  }

  const db = await createClient();
  const { data, error } = await db
    .from("job_applications")
    .select(
      "id,rating,applied_at,application_status,applicants(id,first_name,middle_name,last_name,current_job_title),job_vacancies(title,departments(name)),recruitment_stages(name),application_stage_history(changed_at)",
    )
    .not("application_status", "in", "(rejected,withdrawn)")
    .order("applied_at", { ascending: false })
    .limit(15);
  if (error) throw new Error(error.message);

  return ((data || []) as Raw[]).map((row) => {
    const applicant = row.applicants as Raw;
    const vacancy = row.job_vacancies as Raw;
    const stage = row.recruitment_stages as Raw;
    const history = ((row.application_stage_history as Raw[]) || []).sort(
      (a, b) =>
        new Date(String(b.changed_at)).getTime() -
        new Date(String(a.changed_at)).getTime(),
    );
    return {
      id: String(row.id),
      applicantId: String(applicant.id),
      name: name(applicant),
      role: String(vacancy?.title || applicant?.current_job_title || "Open role"),
      department: String((vacancy?.departments as Raw)?.name || "Unassigned"),
      rating: Number(row.rating || 0),
      daysInStage: elapsedDays(history[0]?.changed_at || row.applied_at),
      column: boardColumn(String(stage?.name || "Applied")),
    };
  });
}

export async function getDashboardOnboarding(): Promise<DashboardOnboarding> {
  if (!isSupabaseConfigured())
    return {
      id: "o1",
      employee: "Miguel Alvarez",
      position: "Software Engineer",
      startDate: "2026-09-01",
      tasks: [
        { id: "ot1", title: "Personal information verified", category: "People", completed: true },
        { id: "ot2", title: "Employment contract signed", category: "People", completed: true },
        { id: "ot3", title: "Company email created", category: "IT", completed: true },
        { id: "ot4", title: "Laptop and equipment assigned", category: "IT", completed: false },
        { id: "ot5", title: "Manager welcome scheduled", category: "Team", completed: false },
        { id: "ot6", title: "Orientation session completed", category: "Learning", completed: false },
      ],
    };

  const db = await createClient();
  const { data, error } = await db
    .from("employee_onboarding")
    .select(
      "id,start_date,employees(first_name,middle_name,last_name,employment_records!employment_records_employee_id_fkey(positions(title),is_current)),onboarding_tasks(id,title,category,status,due_date,created_at)",
    )
    .in("status", ["not_started", "in_progress", "ready"])
    .is("deleted_at", null)
    .order("start_date")
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;

  const row = data as unknown as Raw;
  const employee = row.employees as Raw;
  const current = ((employee?.employment_records as Raw[]) || []).find(
    (record) => record.is_current,
  );
  const tasks = ((row.onboarding_tasks as Raw[]) || []).sort((a, b) =>
    String(a.due_date || a.created_at).localeCompare(
      String(b.due_date || b.created_at),
    ),
  );
  return {
    id: String(row.id),
    employee: name(employee),
    position: String((current?.positions as Raw)?.title || "New employee"),
    startDate: String(row.start_date),
    tasks: tasks.map((task) => ({
      id: String(task.id),
      title: String(task.title),
      category: String(task.category),
      completed: task.status === "completed",
    })),
  };
}

export async function getDashboardAnalytics(): Promise<DashboardAnalytics> {
  if (!isSupabaseConfigured())
    return {
      trend: [
        { month: "Mar", applications: 48, hires: 7 },
        { month: "Apr", applications: 57, hires: 9 },
        { month: "May", applications: 62, hires: 8 },
        { month: "Jun", applications: 71, hires: 12 },
        { month: "Jul", applications: 68, hires: 11 },
        { month: "Aug", applications: 86, hires: 14 },
      ],
      pipeline: [
        { stage: "Applied", candidates: 86 },
        { stage: "Screening", candidates: 54 },
        { stage: "Interview", candidates: 31 },
        { stage: "Assessment", candidates: 18 },
        { stage: "Offer", candidates: 9 },
        { stage: "Hired", candidates: 6 },
      ],
      departments: [
        { name: "Technology", value: 412 },
        { name: "Operations", value: 368 },
        { name: "Finance", value: 146 },
        { name: "Sales", value: 188 },
        { name: "People", value: 52 },
        { name: "Other", value: 118 },
      ],
    };
  const db = await createClient();
  const monthStarts = Array.from({ length: 6 }, (_, index) => {
    const date = new Date();
    date.setDate(1);
    date.setHours(0, 0, 0, 0);
    date.setMonth(date.getMonth() - (5 - index));
    return date;
  });
  const since = monthStarts[0].toISOString();
  const [applicationsResult, hiresResult, stagesResult, departmentsResult] =
    await Promise.all([
      db.from("job_applications").select("applied_at").gte("applied_at", since),
      db
        .from("employees")
        .select("hire_date")
        .gte("hire_date", since.slice(0, 10))
        .is("deleted_at", null),
      db
        .from("recruitment_stages")
        .select("name,stage_order,job_applications(count)")
        .eq("is_active", true)
        .order("stage_order"),
      db
        .from("departments")
        .select("name,employment_records(count)")
        .eq("status", "active")
        .eq("employment_records.is_current", true)
        .order("name"),
    ]);
  const key = (value: string | Date) => {
    const date = new Date(value);
    return `${date.getFullYear()}-${date.getMonth()}`;
  };
  const applicationCounts = new Map<string, number>();
  for (const row of applicationsResult.data || [])
    applicationCounts.set(
      key(row.applied_at),
      (applicationCounts.get(key(row.applied_at)) || 0) + 1,
    );
  const hireCounts = new Map<string, number>();
  for (const row of hiresResult.data || [])
    hireCounts.set(
      key(row.hire_date),
      (hireCounts.get(key(row.hire_date)) || 0) + 1,
    );
  const trend = monthStarts.map((date) => ({
    month: date.toLocaleDateString("en", { month: "short" }),
    applications: applicationCounts.get(key(date)) || 0,
    hires: hireCounts.get(key(date)) || 0,
  }));
  const pipeline = ((stagesResult.data || []) as Raw[])
    .filter((row) => !["Rejected", "Withdrawn"].includes(String(row.name)))
    .map((row) => ({
      stage: String(row.name),
      candidates: Number((row.job_applications as Raw[])?.[0]?.count || 0),
    }));
  const departmentRows = ((departmentsResult.data || []) as Raw[])
    .map((row) => ({
      name: String(row.name),
      value: Number((row.employment_records as Raw[])?.[0]?.count || 0),
    }))
    .sort((a, b) => b.value - a.value);
  const departments =
    departmentRows.length > 6
      ? [
          ...departmentRows.slice(0, 5),
          {
            name: "Other",
            value: departmentRows
              .slice(5)
              .reduce((total, row) => total + row.value, 0),
          },
        ]
      : departmentRows;
  return { trend, pipeline, departments };
}
