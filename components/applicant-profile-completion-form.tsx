"use client";

import { useActionState } from "react";
import { CheckCircle2, GraduationCap, LoaderCircle, Send, UserRoundCheck } from "lucide-react";
import { useFormStatus } from "react-dom";
import {
  completeScreenedApplicantProfile,
  type ProfileCompletionState,
} from "@/app/(public)/careers/actions";

const initialProfileCompletionState: ProfileCompletionState = { status: "idle" };

export function ApplicantProfileCompletionForm({ token }: { token: string }) {
  const [state, action] = useActionState(
    completeScreenedApplicantProfile,
    initialProfileCompletionState,
  );

  if (state.status === "success")
    return (
      <section className="rounded-3xl border border-emerald-200 bg-emerald-50 p-6 text-center sm:p-8">
        <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600" />
        <h2 className="mt-4 text-xl font-extrabold text-emerald-950">Education details submitted</h2>
        <p className="mt-2 text-sm leading-6 text-emerald-800">{state.message}</p>
      </section>
    );

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="token" value={token} />
      <section className="rounded-3xl bg-gradient-to-br from-brand-900 to-slate-950 p-6 text-white shadow-xl shadow-blue-950/10 sm:p-8">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.14em] text-brand-300">
          <UserRoundCheck className="h-4 w-4" /> Resume screening passed
        </div>
        <h2 className="mt-3 text-2xl font-extrabold">Complete your education details</h2>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-blue-100">
          You have progressed beyond resume screening. Your resume already provides your professional experience, so only your education details are needed here.
        </p>
      </section>

      {state.status === "error" && (
        <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{state.message}</div>
      )}

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

function Field({ name, label, type = "text", required, placeholder, error, span }: { name: string; label: string; type?: string; required?: boolean; placeholder?: string; error?: string; span?: boolean }) {
  return (
    <label className={`text-xs font-bold text-slate-700 ${span ? "sm:col-span-2" : ""}`}>
      {label}{required && <span className="text-rose-500"> *</span>}
      <input name={name} type={type} required={required} placeholder={placeholder} className="field-control mt-2 bg-white" />
      {error && <span className="mt-1.5 block text-xs font-medium text-rose-600">{error}</span>}
    </label>
  );
}

function CompletionButton() {
  const { pending } = useFormStatus();
  return <button disabled={pending} className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-brand-600 px-6 text-sm font-bold text-white hover:bg-brand-500 disabled:opacity-50">{pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}{pending ? "Submitting..." : "Submit education details"}</button>;
}
