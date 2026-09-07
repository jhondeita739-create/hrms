import { redirect } from "next/navigation";
import { MfaShell } from "@/components/mfa-shell";
import { MfaVerification } from "@/components/mfa-verification";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";

function safePath(value: string | undefined) {
  return value?.startsWith("/") &&
    !value.startsWith("//") &&
    !value.startsWith("/mfa")
    ? value
    : "/hr/dashboard";
}

export default async function MfaVerifyPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  if (!isSupabaseConfigured()) redirect("/login");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const nextPath = safePath((await searchParams).next);
  return <MfaShell eyebrow="Identity verification" title="Enter your security code" description="Your password was accepted. Complete the second verification step to open the protected HRMS workspace."><MfaVerification nextPath={nextPath} /></MfaShell>;
}
