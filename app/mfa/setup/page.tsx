import { redirect } from "next/navigation";
import { MfaEnrollment } from "@/components/mfa-enrollment";
import { MfaShell } from "@/components/mfa-shell";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";

function safePath(value: string | undefined) {
  return value?.startsWith("/") &&
    !value.startsWith("//") &&
    !value.startsWith("/mfa")
    ? value
    : "/hr/dashboard";
}

export default async function MfaSetupPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  if (!isSupabaseConfigured()) redirect("/login");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const nextPath = safePath((await searchParams).next);
  return <MfaShell eyebrow="Multi-factor authentication" title="Protect your account" description="HRMS requires an authenticator-generated code in addition to your password. This protects employee records even if a password is compromised."><MfaEnrollment nextPath={nextPath} /></MfaShell>;
}
