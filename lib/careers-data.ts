import "server-only";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { demoData } from "@/lib/demo-data";

export type PublicVacancy = {
  id: string;
  vacancyNumber: string;
  title: string;
  department: string;
  location: string;
  employmentType: string;
  workArrangement: string;
  openings: number;
  description: string;
  responsibilities: string;
  qualifications: string;
  requiredSkills: string[];
  salaryMin: number | null;
  salaryMax: number | null;
  currency: string;
  publishedAt: string | null;
  closingDate: string | null;
};

const previewDescriptions: Record<
  string,
  {
    description: string;
    responsibilities: string;
    qualifications: string;
    skills: string[];
  }
> = {
  "Senior Accountant": {
    description:
      "Own critical accounting operations and help strengthen financial controls as the organization grows.",
    responsibilities:
      "Manage month-end close, reconciliations, financial reporting, and audit preparation. Partner with operating teams to improve finance processes.",
    qualifications:
      "CPA preferred with at least five years of relevant accounting experience and strong knowledge of Philippine financial reporting standards.",
    skills: [
      "Financial reporting",
      "Reconciliation",
      "ERP systems",
      "Audit support",
    ],
  },
  "Backend Engineer": {
    description:
      "Build dependable services and data systems that power our employee and customer experiences.",
    responsibilities:
      "Design APIs, improve platform reliability, review code, and collaborate with product and frontend teams on secure, scalable features.",
    qualifications:
      "Strong experience with TypeScript or a comparable backend language, PostgreSQL, API design, testing, and cloud infrastructure.",
    skills: ["TypeScript", "PostgreSQL", "API design", "Cloud infrastructure"],
  },
  "Product Designer": {
    description:
      "Shape clear, thoughtful product experiences for complex operational workflows.",
    responsibilities:
      "Lead discovery, interaction design, prototyping, usability testing, and design-system contributions in close partnership with product and engineering.",
    qualifications:
      "A strong product-design portfolio showing systems thinking, research, and polished execution for responsive web applications.",
    skills: [
      "Product design",
      "User research",
      "Prototyping",
      "Design systems",
    ],
  },
  "Operations Associate": {
    description:
      "Help our operations team deliver reliable, responsive service at scale.",
    responsibilities:
      "Coordinate daily workflows, resolve operational issues, maintain accurate records, and identify practical process improvements.",
    qualifications:
      "Excellent organization and communication skills with an analytical, service-oriented approach to work.",
    skills: [
      "Operations",
      "Customer service",
      "Data accuracy",
      "Process improvement",
    ],
  },
};

export async function getPublicVacancies(): Promise<PublicVacancy[]> {
  if (!isAdminConfigured())
    return demoData.vacancies
      .filter((item) => item.status === "open")
      .map((item) => {
        const extra = previewDescriptions[String(item.title)] || {
          description:
            "Join our growing team and make a meaningful contribution.",
          responsibilities:
            "Collaborate with the team to deliver excellent work.",
          qualifications:
            "Relevant experience and a commitment to continuous learning.",
          skills: [],
        };
        return {
          id: item.id,
          vacancyNumber: String(item.vacancy_number),
          title: String(item.title),
          department: String(item.department),
          location: "Metro Manila",
          employmentType: String(item.employment_type),
          workArrangement: String(item.work_arrangement),
          openings: Number(item.number_of_openings),
          description: extra.description,
          responsibilities: extra.responsibilities,
          qualifications: extra.qualifications,
          requiredSkills: extra.skills,
          salaryMin: null,
          salaryMax: null,
          currency: "PHP",
          publishedAt: "2026-08-20",
          closingDate: String(item.closing_date),
        };
      });
  const db = createAdminClient();
  const { data, error } = await db
    .from("job_vacancies")
    .select(
      "id,vacancy_number,title,employment_type,work_arrangement,number_of_openings,description,responsibilities,qualifications,required_skills,salary_min,salary_max,currency,published_at,closing_date,departments(name),locations(name,city)",
    )
    .eq("status", "open")
    .is("deleted_at", null)
    .order("published_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data || []).map((row) => {
    const department = row.departments as unknown as { name?: string } | null;
    const location = row.locations as unknown as {
      name?: string;
      city?: string;
    } | null;
    return {
      id: row.id,
      vacancyNumber: row.vacancy_number,
      title: row.title,
      department: department?.name || "General",
      location: location?.city || location?.name || "Philippines",
      employmentType: row.employment_type,
      workArrangement: row.work_arrangement,
      openings: row.number_of_openings,
      description: row.description || "",
      responsibilities: row.responsibilities || "",
      qualifications: row.qualifications || "",
      requiredSkills: row.required_skills || [],
      salaryMin: row.salary_min,
      salaryMax: row.salary_max,
      currency: row.currency,
      publishedAt: row.published_at,
      closingDate: row.closing_date,
    };
  });
}

export async function getPublicVacancy(id: string) {
  return (
    (await getPublicVacancies()).find((vacancy) => vacancy.id === id) || null
  );
}
