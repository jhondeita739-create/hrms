"use client";
import { useActionState } from "react";
import { CheckCircle2, Clock3, LoaderCircle, Search } from "lucide-react";
import { useFormStatus } from "react-dom";
import {
  initialTrackingState,
  trackApplication,
} from "@/app/(public)/careers/actions";
import { formatDate } from "@/lib/utils";

export function ApplicationTracker() {
  const [state, action] = useActionState(
    trackApplication,
    initialTrackingState,
  );
  return (
    <div className="w-full">
      <form
        action={action}
        className="rounded-xl border border-slate-200 bg-white p-5 shadow-panel sm:p-7"
      >
        <div className="grid gap-4">
          <div>
            <label className="field-label" htmlFor="reference">
              Application reference
            </label>
            <input
              className="field-control font-mono uppercase"
              id="reference"
              name="reference"
              required
              placeholder="APL-260829-AB12"
            />
          </div>
          <div>
            <label className="field-label" htmlFor="tracking_email">
              Email used to apply
            </label>
            <input
              className="field-control"
              id="tracking_email"
              name="email"
              type="email"
              required
              placeholder="you@email.com"
            />
          </div>
          <TrackButton />
        </div>
        {state.status === "error" && (
          <p
            role="alert"
            className="mt-4 rounded-md bg-red-50 p-3 text-xs text-red-700"
          >
            {state.message}
          </p>
        )}
      </form>
      {state.status === "success" && state.result && (
        <div className="mt-5 overflow-hidden rounded-xl border border-blue-200 bg-white shadow-panel">
          <div className="bg-brand-900 p-5 text-white">
            <div className="text-[10px] font-semibold uppercase tracking-[.12em] text-blue-200">
              {state.result.reference}
            </div>
            <h2 className="mt-2 text-xl font-semibold">
              {state.result.position}
            </h2>
            <p className="mt-1 text-xs text-blue-100/75">
              Applied {formatDate(state.result.appliedAt)}
            </p>
          </div>
          <div className="p-5">
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-full bg-brand-100 text-brand-700">
                <Clock3 className="h-5 w-5" />
              </span>
              <div>
                <div className="text-xs font-semibold uppercase tracking-[.08em] text-slate-400">
                  Current stage
                </div>
                <div className="mt-1 text-base font-semibold text-slate-900">
                  {state.result.stage}
                </div>
                <div className="mt-1 text-xs capitalize text-slate-500">
                  {state.result.applicationStatus.replaceAll("_", " ")}
                </div>
              </div>
            </div>
            <div className="mt-5 flex items-center gap-2 border-t border-slate-100 pt-4 text-xs text-slate-500">
              <CheckCircle2 className="h-4 w-4 text-brand-600" />
              We’ll contact you when there is an update.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
function TrackButton() {
  const { pending } = useFormStatus();
  return (
    <button
      disabled={pending}
      className="mt-1 flex h-10 items-center justify-center gap-2 rounded-md bg-brand-900 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-60"
    >
      {pending ? (
        <LoaderCircle className="h-4 w-4 animate-spin" />
      ) : (
        <Search className="h-4 w-4" />
      )}
      {pending ? "Checking…" : "Check status"}
    </button>
  );
}
