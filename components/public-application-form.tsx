"use client";

import { useActionState } from "react";
import {
  CheckCircle2,
  FileText,
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
  if (state.status === "success")
    return (
      <div className="rounded-xl border border-blue-200 bg-brand-50 p-6 sm:p-8">
        <span className="grid h-12 w-12 place-items-center rounded-full bg-brand-600 text-white">
          <CheckCircle2 className="h-6 w-6" />
        </span>
        <h2 className="mt-5 text-xl font-semibold tracking-[-.02em]">
          Application received
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">{state.message}</p>
        <div className="mt-6 rounded-lg border border-blue-200 bg-white p-4">
          <div className="text-[10px] font-semibold uppercase tracking-[.12em] text-slate-400">
            Application reference
          </div>
          <div className="mt-1 font-mono text-base font-semibold text-brand-900">
            {state.reference}
          </div>
        </div>
        <p className="mt-4 text-xs leading-5 text-slate-500">
          Save this reference. You’ll need it with your email address to track
          your application.
        </p>
        <a
          href="/careers/track"
          className="mt-6 inline-flex h-10 items-center rounded-md bg-brand-900 px-4 text-sm font-semibold text-white hover:bg-brand-600"
        >
          Track application
        </a>
      </div>
    );
  return (
    <form action={action} className="space-y-8">
      <input type="hidden" name="vacancy_id" value={vacancyId} />
      <div className="absolute -left-[9999px]" aria-hidden="true">
        <label htmlFor="website">Website</label>
        <input id="website" name="website" tabIndex={-1} autoComplete="off" />
      </div>
      {state.status === "error" && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700"
        >
          {state.message}
        </div>
      )}
      <FormSection
        title="Personal information"
        description="How we can identify and contact you"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="First name"
            name="first_name"
            required
            error={state.fieldErrors?.first_name}
          />
          <Field
            label="Last name"
            name="last_name"
            required
            error={state.fieldErrors?.last_name}
          />
          <Field
            label="Email address"
            name="email"
            type="email"
            required
            error={state.fieldErrors?.email}
          />
          <Field
            label="Phone number"
            name="phone"
            type="tel"
            required
            error={state.fieldErrors?.phone}
          />
          <Field
            label="City"
            name="city"
            required
            error={state.fieldErrors?.city}
          />
          <Field
            label="Province / region"
            name="region"
            required
            error={state.fieldErrors?.region}
          />
          <Field
            label="LinkedIn profile"
            name="linkedin_url"
            type="url"
            placeholder="https://linkedin.com/in/…"
            error={state.fieldErrors?.linkedin_url}
            span
          />
        </div>
      </FormSection>
      <FormSection
        title="Professional background"
        description="A concise overview is enough"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Current job title" name="current_job_title" />
          <Field label="Current employer" name="current_employer" />
          <Field
            label="Years of experience"
            name="years_experience"
            type="number"
            min="0"
            max="60"
            defaultValue="0"
          />
          <Field
            label="Expected monthly salary"
            name="expected_salary"
            type="number"
            min="0"
          />
          <Field label="Available from" name="availability_date" type="date" />
        </div>
      </FormSection>
      <FormSection
        title="Education"
        description="Your most relevant or highest qualification"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="School or university" name="school" span />
          <Field label="Degree" name="degree" />
          <Field label="Field of study" name="field_of_study" />
        </div>
      </FormSection>
      <FormSection
        title="Relevant experience"
        description="Add your most recent or relevant role"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Company" name="experience_company" />
          <Field label="Position" name="experience_position" />
          <Field label="Start date" name="experience_start" type="date" />
          <Field
            label="End date"
            name="experience_end"
            type="date"
            helper="Leave blank if this is your current role."
          />
        </div>
      </FormSection>
      <FormSection title="Application" description={`Apply for ${position}`}>
        <div>
          <label htmlFor="cover_letter" className="field-label">
            Why are you interested in this role?
          </label>
          <textarea
            id="cover_letter"
            name="cover_letter"
            rows={5}
            maxLength={5000}
            className="field-control h-auto py-2.5"
            placeholder="Tell us briefly what interests you and what you would bring to the role."
          />
        </div>
        <div className="mt-4">
          <label htmlFor="resume" className="field-label">
            Resume / CV <span className="text-red-500">*</span>
          </label>
          <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 transition hover:border-blue-400 hover:bg-brand-50">
            <span className="grid h-10 w-10 place-items-center rounded-md bg-white text-brand-700 shadow-sm">
              <FileText className="h-5 w-5" />
            </span>
            <span>
              <span className="block text-sm font-medium text-slate-700">
                Choose your resume
              </span>
              <span className="mt-1 block text-xs text-slate-400">
                PDF, DOC, or DOCX · Maximum 5 MB
              </span>
            </span>
            <input
              id="resume"
              name="resume"
              type="file"
              required
              accept=".pdf,.doc,.docx"
              className="sr-only"
            />
          </label>
          {state.fieldErrors?.resume && (
            <p className="mt-1.5 text-xs text-red-600">
              {state.fieldErrors.resume}
            </p>
          )}
        </div>
      </FormSection>
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
        <label className="flex items-start gap-3">
          <input
            name="consent"
            type="checkbox"
            required
            className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
          />
          <span className="text-xs leading-5 text-slate-600">
            I confirm that the information provided is accurate and consent to
            HRMS processing my information for recruitment and related
            hiring activities.
          </span>
        </label>
        {state.fieldErrors?.consent && (
          <p className="mt-2 text-xs text-red-600">
            {state.fieldErrors.consent}
          </p>
        )}
      </div>
      <div className="flex flex-col gap-3 border-t border-slate-200 pt-6 sm:flex-row sm:items-center sm:justify-between">
        <span className="flex items-center gap-2 text-[11px] text-slate-400">
          <LockKeyhole className="h-3.5 w-3.5" />
          Your application and files are stored privately.
        </span>
        <SubmitButton />
      </div>
    </form>
  );
}
function FormSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset>
      <legend className="text-sm font-semibold text-slate-900">{title}</legend>
      <p className="mt-1 text-xs text-slate-400">{description}</p>
      <div className="mt-4">{children}</div>
    </fieldset>
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
  helper?: string;
  min?: string;
  max?: string;
  defaultValue?: string;
};
function Field({
  label,
  name,
  type = "text",
  required,
  placeholder,
  error,
  span,
  helper,
  ...props
}: FieldProps) {
  return (
    <div className={span ? "sm:col-span-2" : ""}>
      <label htmlFor={name} className="field-label">
        {label}
        {required && <span className="ml-0.5 text-red-500">*</span>}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        className="field-control"
        {...props}
      />
      {helper && <p className="mt-1.5 text-[11px] text-slate-400">{helper}</p>}
      {error && <p className="mt-1.5 text-xs text-red-600">{error}</p>}
    </div>
  );
}
function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      disabled={pending}
      className="flex h-11 items-center justify-center gap-2 rounded-md bg-brand-900 px-5 text-sm font-semibold text-white hover:bg-brand-600 disabled:cursor-wait disabled:opacity-60"
    >
      {pending ? (
        <>
          <LoaderCircle className="h-4 w-4 animate-spin" />
          Submitting…
        </>
      ) : (
        <>
          Submit application <Send className="h-4 w-4" />
        </>
      )}
    </button>
  );
}
