"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";

export type ProfileActionState = {
  status: "idle" | "success" | "error";
  message: string;
  fieldErrors?: {
    full_name?: string[];
    job_title?: string[];
  };
};

export type PasswordActionState = {
  status: "idle" | "error";
  message: string;
};

const profileSchema = z.object({
  full_name: z
    .string()
    .trim()
    .min(2, "Enter at least 2 characters.")
    .max(100, "Keep the name under 100 characters."),
  job_title: z
    .string()
    .trim()
    .max(120, "Keep the job title under 120 characters."),
});

export async function updateProfile(
  _previousState: ProfileActionState,
  formData: FormData,
): Promise<ProfileActionState> {
  if (!isSupabaseConfigured()) {
    return {
      status: "success",
      message: "Profile changes are simulated in preview mode.",
    };
  }

  const parsed = profileSchema.safeParse({
    full_name: String(formData.get("full_name") ?? ""),
    job_title: String(formData.get("job_title") ?? ""),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: "Please correct the highlighted fields.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { status: "error", message: "Your session expired. Sign in again." };
  }
  const { data: assurance } =
    await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (assurance?.currentLevel !== "aal2") {
    return {
      status: "error",
      message: "Complete multi-factor authentication before changing your profile.",
    };
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: parsed.data.full_name,
      job_title: parsed.data.job_title || null,
    })
    .eq("id", user.id);

  if (error) return { status: "error", message: error.message };

  revalidatePath("/hr", "layout");
  revalidatePath("/hr/profile");
  return { status: "success", message: "Your profile has been updated." };
}

export async function signOut() {
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }

  redirect("/login?message=You have been signed out");
}

export async function setInitialPassword(
  _previousState: PasswordActionState,
  formData: FormData,
): Promise<PasswordActionState> {
  const password = String(formData.get("password") || "");
  const confirmation = String(formData.get("confirm_password") || "");
  if (password.length < 8)
    return { status: "error", message: "Use at least 8 characters for your password." };
  if (password !== confirmation)
    return { status: "error", message: "The password confirmation does not match." };
  if (!isSupabaseConfigured())
    return { status: "error", message: "Supabase authentication is not configured." };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "error", message: "Your invitation expired. Request a new one from HR." };
  const { data: assurance } =
    await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (assurance?.nextLevel === "aal2" && assurance.currentLevel !== "aal2")
    return {
      status: "error",
      message: "Verify your existing authenticator before changing this password.",
    };
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { status: "error", message: error.message };
  redirect(`/mfa/setup?next=${encodeURIComponent("/employee/onboarding")}`);
}
