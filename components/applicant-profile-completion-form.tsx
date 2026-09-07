"use client";

import { useActionState } from "react";
import { CheckCircle2, GraduationCap, LoaderCircle, Send, UserRoundCheck } from "lucide-react";
import { useFormStatus } from "react-dom";
import {
  completeScreenedApplicantProfile,
  initialProfileCompletionState,
} from "@/app/(public)/careers/actions";

export function ApplicantProfileCompletionForm({ token }: { token: string }) {
  const [state, action] = useActionState(
    completeScreenedApplicantProfile,
    initialProfileCompletionState,
  );

  if (state.status === "success")
    return (
      <section className="rounded-3xl border border-emerald-200 bg-emerald-50 p-6 text-center sm:p-8">
        <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600" />
        <h2 className="mt-4 text-xl font-extrabold text-emerald-950">Profile completed</h2>
        <p className="mt-2 text-sm leading-6 text-emerald-800">{state.message}</p>
      </section>
    );

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="token" value={token} />
      <section className="rounded-3xl bg-brand-950 p-6 text-white sm:p-8">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.14em] text-brand-300">
          <UserRoundCheck className="h-4 w-4" /> Resume screening passed
        </div>
        <h2 className="mt-3 text-2xl font-extrabold">Complete your applicant profile</h2>
        <p className="mt-3 text-sm leading-6 text-blue-100/80">
          You have progressed beyond resume screening. HR now needs your complete professional and education details before continuing the interview process.
        </p>
      </section>

      {state.status === "error" && (
        <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{state.message}</div>
      )}

      <ProfileSection title="Professional profile" description="Your current background and availability">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field name="current_job_title" label="Current or most recent role" required error={state.fieldErrors?.current_job_title} />
          <Field name="current_employer" label="Current employer" />
          <Field name="years_experience" label="Years of experience" type="number" min="0" max="60" required error={state.fieldErrors?.years_experience} />
          <Field name="alternative_phone" label="Alternative phone" type="tel" numbersOnly error={state.fieldErrors?.alternative_phone} />
          <Field name="linkedin_url" label="LinkedIn profile" type="url" placeholder="https://linkedin.com/in/..." error={state.fieldErrors?.linkedin_url} />
          <Field name="expected_salary" label="Expected monthly salary" type="number" min="0" />
          <Field name="availability_date" label="Available from" type="date" />
        </div>
        <label className="mt-4 block text-xs font-bold text-slate-700">
          About your professional background <span className="text-rose-500">*</span>
          <textarea name="about" required minLength={30} maxLength={3000} rows={5} className="field-control mt-2 h-auto py-3" placeholder="Summarize your strengths, experience, and interest in this opportunity." />
          {state.fieldErrors?.about && <span className="mt-1.5 block text-xs text-rose-600">{state.fieldErrors.about}</span>}
        </label>
      </ProfileSection>

      <ProfileSection title="Education" description="Your highest or most relevant qualification" icon="education">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field name="school" label="School or university" required span error={state.fieldErrors?.school} />
          <Field name="degree" label="Degree or qualification" required error={state.fieldErrors?.degree} />
          <Field name="field_of_study" label="Field of study" required error={state.fieldErrors?.field_of_study} />
          <Field name="education_start" label="Start date" type="date" />
          <Field name="education_end" label="End date" type="date" />
        </div>
        <label className="mt-4 block text-xs font-bold text-slate-700">Honors or education notes<textarea name="education_notes" maxLength={1000} rows={3} className="field-control mt-2 h-auto py-3" /></label>
      </ProfileSection>

      <ProfileSection title="Relevant experience" description="Optional for first-time job seekers">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field name="experience_company" label="Company" error={state.fieldErrors?.experience_company} />
          <Field name="experience_position" label="Position" error={state.fieldErrors?.experience_position} />
          <Field name="employment_type" label="Employment type" placeholder="Full-time, internship, contract..." />
          <Field name="experience_start" label="Start date" type="date" />
          <Field name="experience_end" label="End date" type="date" />
          <label className="flex items-center gap-3 self-end rounded-xl border border-slate-200 px-4 py-3 text-xs font-bold text-slate-700"><input name="currently_employed" type="checkbox" className="h-4 w-4 rounded border-slate-300 text-brand-600" />I currently work here</label>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="text-xs font-bold text-slate-700">Responsibilities<textarea name="responsibilities" maxLength={2000} rows={4} className="field-control mt-2 h-auto py-3" /></label>
          <label className="text-xs font-bold text-slate-700">Achievements<textarea name="achievements" maxLength={2000} rows={4} className="field-control mt-2 h-auto py-3" /></label>
        </div>
      </ProfileSection>

      <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs leading-5 text-slate-500">This secure link is single-use and expires after 14 days.</p>
        <CompletionButton />
      </div>
    </form>
  );
}

function ProfileSection({ title, description, icon, children }: { title: string; description: string; icon?: "education"; children: React.ReactNode }) {
  return (
    <fieldset className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
      <legend className="sr-only">{title}</legend>
      <div className="flex items-start gap-3 border-b border-slate-100 pb-5">
        {icon === "education" && <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700"><GraduationCap className="h-5 w-5" /></span>}
        <div><h3 className="text-base font-extrabold text-slate-900">{title}</h3><p className="mt-1 text-xs text-slate-500">{description}</p></div>
      </div>
      <div className="mt-5">{children}</div>
    </fieldset>
  );
}

function Field({ name, label, type = "text", required, placeholder, error, span, numbersOnly, min, max }: { name: string; label: string; type?: string; required?: boolean; placeholder?: string; error?: string; span?: boolean; numbersOnly?: boolean; min?: string; max?: string }) {
  return (
    <label className={`text-xs font-bold text-slate-700 ${span ? "sm:col-span-2" : ""}`}>
      {label}{required && <span className="text-rose-500"> *</span>}
      <input name={name} type={type} required={required} placeholder={placeholder} min={min} max={max} inputMode={numbersOnly ? "numeric" : undefined} pattern={numbersOnly ? "[0-9]{7,15}" : undefined} maxLength={numbersOnly ? 15 : undefined} onInput={numbersOnly ? (event) => { event.currentTarget.value = event.currentTarget.value.replace(/\D/g, ""); } : undefined} className="field-control mt-2 bg-white" />
      {error && <span className="mt-1.5 block text-xs font-medium text-rose-600">{error}</span>}
    </label>
  );
}

function CompletionButton() {
  const { pending } = useFormStatus();
  return <button disabled={pending} className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-brand-600 px-6 text-sm font-bold text-white hover:bg-brand-500 disabled:opacity-50">{pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}{pending ? "Submitting..." : "Submit complete profile"}</button>;
}
