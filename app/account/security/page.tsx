import Image from "next/image";
import { redirect } from "next/navigation";
import { ArrowLeft, LockKeyhole } from "lucide-react";
import { MfaSecurityManager } from "@/components/mfa-security-manager";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import payrollLogo from "../../../Payroll-logo-removebg.png";

export default async function AccountSecurityPage() {
  if (!isSupabaseConfigured()) redirect("/login");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const returnPath = user.user_metadata?.account_type === "temporary_employee"
    ? "/employee/onboarding"
    : "/hr/profile";
  const { data: assurance } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (assurance?.nextLevel === "aal2" && assurance.currentLevel !== "aal2")
    redirect(`/mfa/verify?next=${encodeURIComponent("/account/security")}`);

  return <main className="grid min-h-screen place-items-center bg-sand px-4 py-10"><section className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl ring-1 ring-slate-200/70 sm:p-8"><Image src={payrollLogo} alt="Priority Handling Logistics, Inc." priority className="h-14 w-auto" /><a href={returnPath} className="mt-7 inline-flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-slate-900"><ArrowLeft className="h-4 w-4" />Back to workspace</a><div className="mt-6 flex items-center gap-2 text-xs font-bold uppercase tracking-[.14em] text-brand-600"><LockKeyhole className="h-4 w-4" />Account security</div><h1 className="mt-3 text-3xl font-black tracking-[-.04em] text-slate-900">Multi-factor authentication</h1><p className="mt-3 text-sm leading-6 text-slate-500">Review or reset the authenticator used for your required second verification step.</p><div className="mt-7 rounded-2xl border border-slate-200 p-5"><MfaSecurityManager returnPath={returnPath} /></div></section></main>;
}
