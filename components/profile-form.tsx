"use client";

import { useActionState } from "react";
import { CheckCircle2, Save } from "lucide-react";
import {
  updateProfile,
  type ProfileActionState,
} from "@/app/actions/account";
import { cn } from "@/lib/utils";

const initialState: ProfileActionState = { status: "idle", message: "" };

export function ProfileForm({
  fullName,
  jobTitle,
  email,
}: {
  fullName: string;
  jobTitle: string;
  email: string;
}) {
  const [state, action, pending] = useActionState(updateProfile, initialState);

  return (
    <form action={action} className="space-y-6">
      <div className="grid gap-5 sm:grid-cols-2">
        <label className="block">
          <span className="field-label">Full name</span>
          <input
            name="full_name"
            defaultValue={fullName}
            autoComplete="name"
            required
            aria-invalid={Boolean(state.fieldErrors?.full_name)}
            aria-describedby="full-name-error"
            className="field-control"
          />
          {state.fieldErrors?.full_name && (
            <span id="full-name-error" className="mt-2 block text-xs font-medium text-rose-600">
              {state.fieldErrors.full_name[0]}
            </span>
          )}
        </label>
        <label className="block">
          <span className="field-label">Job title</span>
          <input
            name="job_title"
            defaultValue={jobTitle}
            autoComplete="organization-title"
            placeholder="e.g. HR Administrator"
            aria-invalid={Boolean(state.fieldErrors?.job_title)}
            aria-describedby="job-title-error"
            className="field-control"
          />
          {state.fieldErrors?.job_title && (
            <span id="job-title-error" className="mt-2 block text-xs font-medium text-rose-600">
              {state.fieldErrors.job_title[0]}
            </span>
          )}
        </label>
      </div>

      <label className="block">
        <span className="field-label">Email address</span>
        <input
          value={email}
          readOnly
          aria-describedby="email-help"
          className="field-control cursor-not-allowed"
        />
        <span id="email-help" className="mt-2 block text-xs leading-5 text-slate-500">
          Your email is managed by your Supabase authentication account.
        </span>
      </label>

      <div className="flex flex-col gap-3 border-t border-slate-100 pt-6 sm:flex-row sm:items-center sm:justify-between">
        <div
          aria-live="polite"
          className={cn(
            "min-h-5 text-xs font-medium",
            state.status === "success" && "text-emerald-700",
            state.status === "error" && "text-rose-600",
            state.status === "idle" && "text-slate-500",
          )}
        >
          {state.status === "success" && (
            <CheckCircle2 className="mr-1.5 inline h-4 w-4 align-text-bottom" />
          )}
          {state.message || "Changes appear throughout your HR workspace."}
        </div>
        <button
          type="submit"
          disabled={pending}
          className="flex h-11 items-center justify-center gap-2 rounded-xl bg-brand-600 px-5 text-sm font-bold text-white shadow-sm transition hover:bg-brand-500 disabled:cursor-wait disabled:opacity-60"
        >
          <Save className="h-4 w-4" />
          {pending ? "Saving…" : "Save changes"}
        </button>
      </div>
    </form>
  );
}
