import { ArrowRight, CheckCircle2, LockKeyhole } from "lucide-react";
import { signIn, signUp } from "./actions";
import { isSupabaseConfigured } from "@/lib/supabase/server";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  const params = await searchParams;
  const configured = isSupabaseConfigured();
  return (
    <main className="grid min-h-screen bg-white lg:grid-cols-[1.05fr_.95fr]">
      <section className="relative hidden overflow-hidden bg-brand-900 p-14 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute -right-48 -top-56 h-[560px] w-[560px] rounded-full border border-white/10" />
        <div className="absolute -right-24 -top-28 h-[340px] w-[340px] rounded-full border border-white/10" />
        <div className="relative flex items-center gap-3 text-sm font-semibold tracking-wide">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-white text-brand-900">
            H
          </span>{" "}
          HRMS
        </div>
        <div className="relative max-w-xl">
          <p className="mb-5 text-xs font-semibold uppercase tracking-[.22em] text-blue-200">
            People operations, connected
          </p>
          <h1 className="text-5xl font-medium leading-[1.08] tracking-[-.04em]">
            Every person. Every move. One trusted record.
          </h1>
          <p className="mt-6 max-w-lg text-lg leading-8 text-blue-50/75">
            Run recruiting, onboarding, employee records, and everyday HR work
            without losing the story between them.
          </p>
        </div>
        <div className="relative flex gap-7 text-sm text-blue-50/70">
          {["Private by design", "Audit ready", "Built for real workflows"].map(
            (item) => (
              <span className="flex items-center gap-2" key={item}>
                <CheckCircle2 className="h-4 w-4 text-blue-300" />
                {item}
              </span>
            ),
          )}
        </div>
      </section>
      <section className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-[420px]">
          <div className="mb-9 lg:hidden">
            <span className="grid h-10 w-10 place-items-center rounded-lg bg-brand-900 font-semibold text-white">
              H
            </span>
          </div>
          <p className="text-sm font-medium text-brand-600">Welcome back</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-[-.03em]">
            Sign in to HRMS
          </h2>
          <p className="mt-3 text-sm leading-6 text-slate-500">
            Access your organization’s secure HR workspace.
          </p>
          {!configured && (
            <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
              <strong>Supabase setup needed.</strong> Copy{" "}
              <code>.env.example</code> to <code>.env.local</code>, add your
              project credentials, then run the migration.
            </div>
          )}
          {params.error && (
            <div className="mt-6 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {params.error}
            </div>
          )}
          {params.message && (
            <div className="mt-6 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
              {params.message}
            </div>
          )}
          <form action={signIn} className="mt-8 space-y-5">
            <div>
              <label className="field-label" htmlFor="email">
                Work email
              </label>
              <input
                className="field-control"
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                placeholder="you@company.com"
              />
            </div>
            <div>
              <div className="flex justify-between">
                <label className="field-label" htmlFor="password">
                  Password
                </label>
                <button
                  className="mb-1.5 text-xs font-medium text-brand-600"
                  type="button"
                >
                  Forgot password?
                </button>
              </div>
              <input
                className="field-control"
                id="password"
                name="password"
                type="password"
                minLength={8}
                autoComplete="current-password"
                required
              />
            </div>
            <button
              disabled={!configured}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-md bg-brand-900 text-sm font-semibold text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Sign in <ArrowRight className="h-4 w-4" />
            </button>
          </form>
          <details className="group mt-5 rounded-lg border border-slate-200 bg-slate-50/50 p-4">
            <summary className="cursor-pointer list-none text-center text-sm font-medium text-brand-700">
              Set up the first administrator
            </summary>
            <form
              action={signUp}
              className="mt-4 space-y-3 border-t border-slate-200 pt-4"
            >
              <div>
                <label className="field-label" htmlFor="full_name">
                  Full name
                </label>
                <input
                  className="field-control"
                  id="full_name"
                  name="full_name"
                  required
                />
              </div>
              <div>
                <label className="field-label" htmlFor="signup_email">
                  Work email
                </label>
                <input
                  className="field-control"
                  id="signup_email"
                  name="email"
                  type="email"
                  required
                />
              </div>
              <div>
                <label className="field-label" htmlFor="signup_password">
                  Password
                </label>
                <input
                  className="field-control"
                  id="signup_password"
                  name="password"
                  type="password"
                  minLength={8}
                  required
                />
              </div>
              <button
                disabled={!configured}
                className="h-10 w-full rounded-md border border-brand-600 bg-white text-sm font-semibold text-brand-700 disabled:opacity-50"
              >
                Create administrator
              </button>
            </form>
          </details>
          <div className="mt-8 flex items-center justify-center gap-2 text-xs text-slate-400">
            <LockKeyhole className="h-3.5 w-3.5" />
            Protected by Supabase Auth and row-level security
          </div>
        </div>
      </section>
    </main>
  );
}
