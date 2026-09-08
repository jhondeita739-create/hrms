"use server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";

export async function signIn(formData: FormData) {
  const supabase = await createClient();
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) redirect(`/login?error=${encodeURIComponent(error.message)}`);

  let isEmployee = data.user?.user_metadata?.account_type === "temporary_employee";
  if (!isEmployee && data.user && isAdminConfigured()) {
    const admin = createAdminClient();
    const { data: lifecycle } = await admin
      .from("employee_account_lifecycle")
      .select("id")
      .eq("user_id", data.user.id)
      .maybeSingle();
    isEmployee = Boolean(lifecycle);
  }

  if (isEmployee && data.user && !data.user.user_metadata?.initial_password_set_at) {
    await supabase.auth.updateUser({
      data: {
        ...data.user.user_metadata,
        initial_password_set_at: new Date().toISOString(),
      },
    });
  }

  const destination = isEmployee ? "/employee/onboarding" : "/hr/dashboard";
  const { data: assurance } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (assurance?.currentLevel !== "aal2") {
    const mfaPath = assurance?.nextLevel === "aal2" ? "/mfa/verify" : "/mfa/setup";
    redirect(`${mfaPath}?next=${encodeURIComponent(destination)}`);
  }
  redirect(destination);
}

export async function signUp(formData: FormData) {
  const supabase = await createClient();
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const fullName = String(formData.get("full_name") ?? "");
  const { error } = await supabase.auth.signUp({ email, password, options: { data: { full_name: fullName } } });
  if (error) redirect(`/login?error=${encodeURIComponent(error.message)}`);
  redirect("/login?message=Check your email to confirm your account");
}
