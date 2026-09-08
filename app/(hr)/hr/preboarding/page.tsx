import type { Metadata } from "next";
import { PreboardingWorkspace } from "@/components/preboarding-workspace";
import { getPreboardingAdminData } from "@/lib/preboarding-data";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Employee preboarding" };

export default async function PreboardingPage() {
  const permanentDeletePermission = isSupabaseConfigured()
    ? createClient().then(async (db) => {
        const { data } = await db.rpc("has_permission", { permission_key: "*" });
        return Boolean(data);
      })
    : Promise.resolve(false);
  const [data, canPermanentlyDelete] = await Promise.all([
    getPreboardingAdminData(),
    permanentDeletePermission,
  ]);
  return (
    <PreboardingWorkspace
      data={data}
      canPermanentlyDelete={canPermanentlyDelete}
    />
  );
}
