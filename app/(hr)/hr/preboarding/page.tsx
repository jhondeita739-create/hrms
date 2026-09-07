import type { Metadata } from "next";
import { PreboardingWorkspace } from "@/components/preboarding-workspace";
import { getPreboardingAdminData } from "@/lib/preboarding-data";

export const metadata: Metadata = { title: "Employee preboarding" };

export default async function PreboardingPage() {
  const data = await getPreboardingAdminData();
  return <PreboardingWorkspace data={data} />;
}
