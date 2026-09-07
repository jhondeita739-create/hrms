import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { EmployeeOnboardingPortal } from "@/components/employee-onboarding-portal";
import { getEmployeeOnboardingData } from "@/lib/preboarding-data";

export const metadata: Metadata = { title: "Employee onboarding" };

export default async function EmployeeOnboardingPage() {
  const data = await getEmployeeOnboardingData();
  if (!data) redirect("/hr/dashboard");
  return <EmployeeOnboardingPortal data={data} />;
}
