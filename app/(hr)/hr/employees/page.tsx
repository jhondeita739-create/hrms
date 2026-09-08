import type { Metadata } from "next";
import { ResourceWorkspace } from "@/components/resource-workspace";
import { getOptions, getResource } from "@/lib/hr-data";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import type { ResourceConfig } from "@/types/resources";

export const metadata: Metadata = { title: "Employees" };

export default async function EmployeesPage() {
  const permanentDeletePermission = isSupabaseConfigured()
    ? createClient().then(async (db) => {
        const { data } = await db.rpc("has_permission", { permission_key: "*" });
        return Boolean(data);
      })
    : Promise.resolve(false);
  const [records, departments, canPermanentlyDelete] = await Promise.all([
    getResource("employees"),
    getOptions("departments"),
    permanentDeletePermission,
  ]);
  const config: ResourceConfig = {
    entity: "employees",
    title: "Employees",
    description: "Maintain the authoritative employee directory and employment lifecycle.",
    singular: "Employee",
    addLabel: "Add employee",
    searchPlaceholder: "Search name, employee number, email, or department...",
    columns: [
      { key: "name", label: "Employee", format: "person" },
      { key: "work_email", label: "Work email" },
      { key: "position", label: "Position" },
      { key: "department", label: "Department" },
      { key: "hire_date", label: "Hire date", format: "date" },
      { key: "employment_status", label: "Status", format: "status" },
    ],
    fields: [
      { name: "first_name", label: "First name", type: "text", required: true, section: "Personal information" },
      { name: "last_name", label: "Last name", type: "text", required: true, section: "Personal information" },
      { name: "work_email", label: "Work email", type: "email", required: true, section: "Contact information" },
      { name: "personal_email", label: "Personal email", type: "email", section: "Contact information" },
      { name: "phone", label: "Phone", type: "tel", section: "Contact information" },
      { name: "hire_date", label: "Hire date", type: "date", required: true, section: "Employment" },
      {
        name: "employment_status",
        label: "Employment status",
        type: "select",
        required: true,
        options: ["active", "probation", "on_leave", "inactive", "separated"].map((value) => ({ label: value.replaceAll("_", " "), value })),
        section: "Employment",
      },
      {
        name: "employment_type",
        label: "Employment type",
        type: "select",
        required: true,
        options: ["Full-time", "Part-time", "Contract", "Internship", "Temporary"].map((value) => ({ label: value, value })),
        section: "Employment",
      },
      {
        name: "department_id",
        label: "Department",
        type: "select",
        options: departments,
        section: "Organization assignment",
        helper: "Assignment changes create a new effective-dated employment record.",
      },
      {
        name: "work_arrangement",
        label: "Work arrangement",
        type: "select",
        required: true,
        options: ["On-site", "Hybrid", "Remote"].map((value) => ({ label: value, value })),
        section: "Organization assignment",
      },
    ],
  };

  return (
    <ResourceWorkspace
      config={config}
      records={records}
      allowPermanentDelete={canPermanentlyDelete}
    />
  );
}
