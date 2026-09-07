"use client";

import { useActionState, useState } from "react";
import {
  CheckCircle2,
  FileCheck2,
  FileText,
  FileUp,
  LoaderCircle,
  LockKeyhole,
  Send,
} from "lucide-react";
import { useFormStatus } from "react-dom";
import {
  initialApplicationState,
  submitPublicApplication,
} from "@/app/(public)/careers/actions";

export function PublicApplicationForm({
  vacancyId,
  position,
}: {
  vacancyId: string;
  position: string;
}) {
  const [state, action] = useActionState(
    submitPublicApplication,
    initialApplicationState,
  );
  const [resumeName, setResumeName] = useState("");

  if (state.status === "success")
    return (
      <div className="rounded-2xl border border-blue-200 bg-brand-50 p-6 sm:p-8">
        <span className="grid h-12 w-12 place-items-center rounded-full bg-brand-600 text-white">
          <CheckCircle2 className="h-6 w-6" />
        </span>
        <h2 className="mt-5 text-xl font-semibold tracking-[-.02em]">Application received</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">{state.message}</p>
        <div className="mt-6 rounded-xl border border-blue-200 bg-white p-4">
          <div className="text-[10px] font-semibold uppercase tracking-[.12em] text-slate-400">Application reference</div>
          <div className="mt-1 font-mono text-base font-semibold text-brand-900">{state.reference}</div>
        </div>
        <p className="mt-4 text-xs leading-5 text-slate-500">
          Save this reference. Use it with your email to see screening results, interview qualification, and requests for additional profile details.
        </p>
        <a href="/careers/track" className="mt-6 inline-flex h-10 items-center rounded-xl bg-brand-900 px-4 text-sm font-semibold text-white hover:bg-brand-600">
          Track application
        </a>
      </div>
    );

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="vacancy_id" value={vacancyId} />
      <div className="absolute -left-[9999px]" aria-hidden="true">
        <label htmlFor="website">Website</label>
        <input id="website" name="website" tabIndex={-1} autoComplete="off" />
      </div>

      {state.status === "error" && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {state.message}
        </div>
      )}

      <fieldset className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-[0_6px_24px_rgb(15,23,42,0.03)] sm:p-7">
        <legend className="sr-only">Contact information</legend>
        <div className="border-b border-slate-100 pb-5">
          <h3 className="text-base font-bold tracking-tight text-slate-900">Contact information</h3>
          <p className="mt-1 text-xs leading-5 text-slate-500">Only the essentials are needed for initial screening.</p>
        </div>
        <div className="mt-6 grid gap-5 sm:grid-cols-2">
          <Field label="Full name" name="full_name" required error={state.fieldErrors?.full_name} span />
          <Field label="Phone number" name="phone" type="tel" required numbersOnly placeholder="09171234567" error={state.fieldErrors?.phone} />
          <Field label="Gmail / email address" name="email" type="email" required placeholder="you@gmail.com" error={state.fieldErrors?.email} />
          <Field label="Location" name="location" required placeholder="City, province or region" error={state.fieldErrors?.location} span />
        </div>
      </fieldset>

      <fieldset className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-[0_6px_24px_rgb(15,23,42,0.03)] sm:p-7">
        <legend className="sr-only">PDF resume</legend>
        <div className="border-b border-slate-100 pb-5">
          <h3 className="text-base font-bold tracking-tight text-slate-900">PDF resume</h3>
          <p className="mt-1 text-xs leading-5 text-slate-500">Apply for {position}</p>
        </div>
        <div className="mt-6">
          <label htmlFor="resume" className="field-label">Upload PDF <span className="text-red-500">*</span></label>
          <label className="group mt-2 flex cursor-pointer flex-col gap-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50/80 p-5 transition-all hover:border-brand-400 hover:bg-brand-50/60 sm:flex-row sm:items-center">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-white text-brand-700 shadow-sm">
              {resumeName ? <FileText className="h-5 w-5" /> : <FileUp className="h-5 w-5" />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-slate-700">{resumeName || "Choose your PDF resume"}</span>
              <span className="mt-1 block text-xs text-slate-400">Searchable PDF only · Maximum 5 MB</span>
            </span>
            <span className="inline-flex h-10 items-center justify-center rounded-full border border-slate-200 bg-white px-4 text-xs font-bold text-slate-700 shadow-sm group-hover:text-brand-700">
              {resumeName ? "Replace PDF" : "Browse PDF"}
            </span>
            <input
              id="resume"
              name="resume"
              type="file"
              required
              accept="application/pdf,.pdf"
              onChange={(event) => setResumeName(event.currentTarget.files?.[0]?.name ?? "")}
              className="sr-only"
            />
          </label>
          {state.fieldErrors?.resume && <p className="mt-1.5 text-xs text-red-600">{state.fieldErrors.resume}</p>}
          <div className="mt-4 flex items-start gap-3 rounded-2xl bg-blue-50 p-4 text-xs leading-5 text-blue-800">
            <FileCheck2 className="mt-0.5 h-4 w-4 shrink-0" />
            The server verifies the PDF format and checks extracted text for resume sections. HR still performs the final document review.
          </div>
        </div>
      </fieldset>

      <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-5">
        <label className="flex items-start gap-3">
          <input name="consent" type="checkbox" required className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500" />
          <span className="text-xs leading-5 text-slate-600">
            I confirm that the information is accurate and consent to its use for recruitment and hiring activities.
          </span>
        </label>
        {state.fieldErrors?.consent && <p className="mt-2 text-xs text-red-600">{state.fieldErrors.consent}</p>}
      </div>

      <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_8px_24px_rgb(15,23,42,0.04)] sm:flex-row sm:items-center sm:justify-between">
        <span className="flex items-center gap-2 text-[11px] text-slate-400">
          <LockKeyhole className="h-3.5 w-3.5" /> Your application and PDF are stored privately.
        </span>
        <SubmitButton />
      </div>
    </form>
  );
}

type FieldProps = {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
  error?: string;
  span?: boolean;
  numbersOnly?: boolean;
};

function Field({ label, name, type = "text", required, placeholder, error, span, numbersOnly }: FieldProps) {
  return (
    <div className={span ? "sm:col-span-2" : ""}>
      <label htmlFor={name} className="field-label">{label}{required && <span className="ml-0.5 text-red-500">*</span>}</label>
      <input
        id={name}
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        inputMode={numbersOnly ? "numeric" : undefined}
        pattern={numbersOnly ? "[0-9]{7,15}" : undefined}
        minLength={numbersOnly ? 7 : undefined}
        maxLength={numbersOnly ? 15 : undefined}
        onInput={numbersOnly ? (event) => { event.currentTarget.value = event.currentTarget.value.replace(/\D/g, ""); } : undefined}
        className="field-control"
      />
      {error && <p className="mt-1.5 text-xs text-red-600">{error}</p>}
    </div>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button disabled={pending} className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-brand-900 px-6 text-sm font-semibold text-white shadow-lg shadow-brand-900/15 transition-all hover:-translate-y-0.5 hover:bg-brand-600 disabled:cursor-wait disabled:opacity-60 sm:w-auto">
      {pending ? <><LoaderCircle className="h-4 w-4 animate-spin" />Submitting...</> : <>Submit application <Send className="h-4 w-4" /></>}
    </button>
  );
}
