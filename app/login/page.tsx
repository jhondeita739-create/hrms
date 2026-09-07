import Image from "next/image";
import { ArrowRight, LockKeyhole, ShieldCheck } from "lucide-react";
import { isSupabaseConfigured } from "@/lib/supabase/server";
import { PasswordInput } from "@/components/password-input";
import payrollLogo from "../../Payroll-logo-removebg.png";
import { signIn, signUp } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  const params = await searchParams;
  const configured = isSupabaseConfigured();

  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden bg-slate-50 px-4 py-10 sm:px-6">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-gradient-to-b from-brand-50/80 to-transparent" />

      <section className="relative w-full max-w-[440px] rounded-3xl border border-slate-200/80 bg-white p-6 shadow-[0_24px_70px_rgba(15,23,42,0.08)] sm:p-8">
        <div className="flex items-center justify-between border-b border-slate-100 pb-6">
          <Image
            src={payrollLogo}
            alt="Priority Handling Logistics, Inc."
            priority
            className="h-14 w-auto object-contain"
          />
          <span className="rounded-full bg-brand-50 px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[.14em] text-brand-700">
            HRMS
          </span>
        </div>

        <div className="pt-7">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.14em] text-brand-600">
            <ShieldCheck className="h-4 w-4" /> Secure access
          </div>
          <h1 className="mt-3 text-3xl font-extrabold tracking-[-.04em] text-slate-950">
            Sign in to HRMS
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-500">
            Use your work account to access the secure HR workspace.
          </p>

          {!configured && (
            <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
              <strong>Supabase setup needed.</strong> Copy <code>.env.example</code> to{" "}
              <code>.env.local</code>, add your project credentials, then run the migrations.
            </div>
          )}
          {params.error && (
            <div role="alert" className="mt-6 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-medium text-rose-700">
              {params.error}
            </div>
          )}
          {params.message && (
            <div role="status" className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-medium text-emerald-700">
              {params.message}
            </div>
          )}

          <form action={signIn} className="mt-7 space-y-5">
            <div>
              <label className="field-label" htmlFor="email">Work email</label>
              <input className="field-control" id="email" name="email" type="email" autoComplete="email" required placeholder="you@company.com" />
            </div>
            <div>
              <label className="field-label" htmlFor="password">Password</label>
              <PasswordInput id="password" autoComplete="current-password" />
            </div>
            <button
              disabled={!configured}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand-700 text-sm font-bold text-white shadow-lg shadow-brand-700/15 transition-colors hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Sign in <ArrowRight className="h-4 w-4" />
            </button>
          </form>

          <details className="group mt-5 rounded-xl border border-slate-200 bg-slate-50/60 p-4">
            <summary className="cursor-pointer list-none text-center text-sm font-semibold text-brand-700">
              Set up the first administrator
            </summary>
            <form action={signUp} className="mt-4 space-y-3 border-t border-slate-200 pt-4">
              <div>
                <label className="field-label" htmlFor="full_name">Full name</label>
                <input className="field-control" id="full_name" name="full_name" required />
              </div>
              <div>
                <label className="field-label" htmlFor="signup_email">Work email</label>
                <input className="field-control" id="signup_email" name="email" type="email" autoComplete="email" required />
              </div>
              <div>
                <label className="field-label" htmlFor="signup_password">Password</label>
                <PasswordInput id="signup_password" autoComplete="new-password" />
              </div>
              <button
                disabled={!configured}
                className="h-11 w-full rounded-xl border border-brand-200 bg-white text-sm font-bold text-brand-700 transition-colors hover:bg-brand-50 disabled:opacity-50"
              >
                Create administrator
              </button>
            </form>
          </details>

          <div className="mt-7 flex items-center justify-center gap-2 text-center text-xs text-slate-400">
            <LockKeyhole className="h-3.5 w-3.5 shrink-0" />
            Protected by Supabase Auth, MFA, and row-level security
          </div>
        </div>
      </section>
    </main>
  );
}
