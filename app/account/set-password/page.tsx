import Image from "next/image";
import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { SetPasswordForm } from "@/components/set-password-form";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import payrollLogo from "../../../Payroll-logo-removebg.png";

export default async function SetPasswordPage() {
  if (!isSupabaseConfigured()) redirect("/login");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?error=Your invitation link has expired");

  return (
    <main className="grid min-h-screen place-items-center bg-sand px-4 py-10">
      <section className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl ring-1 ring-slate-200/70 sm:p-8">
        <Image src={payrollLogo} alt="Priority Handling Logistics, Inc." priority className="h-14 w-auto" />
        <div className="mt-7 flex items-center gap-2 text-xs font-bold uppercase tracking-[.14em] text-brand-600">
          <ShieldCheck className="h-4 w-4" /> Secure invitation
        </div>
        <h1 className="mt-3 text-3xl font-black tracking-[-.04em] text-slate-900">Activate your account</h1>
        <p className="mt-3 text-sm leading-6 text-slate-500">
          Create a password to access your private document checklist and employee onboarding schedule.
        </p>
        <SetPasswordForm />
      </section>
    </main>
  );
}
