"use client";
import { useActionState } from "react";
import {
  BellRing,
  CheckCircle2,
  Clock3,
  LoaderCircle,
  Search,
} from "lucide-react";
import { useFormStatus } from "react-dom";
import {
  trackApplication,
  type TrackingState,
} from "@/app/(public)/careers/actions";
import { formatDate } from "@/lib/utils";

const initialTrackingState: TrackingState = { status: "idle" };

export function ApplicationTracker() {
  const [state, action] = useActionState(
    trackApplication,
    initialTrackingState,
  );
  const qualifiedForInterview = Boolean(
    state.result?.notifications.some(
      (notification) =>
        notification.eventType === "qualified_for_interview" ||
        notification.eventType === "interview_scheduled",
    ) || state.result?.stage.toLowerCase().includes("interview"),
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
            {qualifiedForInterview && (
              <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                <div className="text-sm font-bold text-emerald-900">Qualified for interview</div>
                <p className="mt-1 text-xs leading-5 text-emerald-700">Check the updates below for scheduling instructions and your secure profile-completion link.</p>
              </div>
            )}
            {state.result.profileCompletionStatus === "requested" && (
              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs leading-5 text-amber-800">
                Your education details are now required. Open the secure single-use link in your screening update or email.
              </div>
            )}
            {state.result.profileCompletionStatus === "completed" && (
              <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-4 text-xs font-semibold text-blue-800">
                Your education details have been received.
              </div>
            )}
            {state.result.notifications.length > 0 && (
              <div className="mt-5 border-t border-slate-100 pt-5">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.1em] text-slate-500">
                  <BellRing className="h-4 w-4 text-brand-600" />
                  Application updates
                </div>
                <div className="mt-3 space-y-3">
                  {state.result.notifications.map((notification) => (
                    <article
                      key={notification.id}
                      className="rounded-xl border border-brand-100 bg-brand-50/60 p-4"
                    >
                      <div className="text-sm font-bold text-slate-900">
                        {notification.subject}
                      </div>
                      <p className="mt-2 text-xs leading-5 text-slate-600">
                        <LinkedMessage text={notification.body} />
                      </p>
                      <p className="mt-3 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                        {formatDate(notification.sentAt)}
                      </p>
                    </article>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function LinkedMessage({ text }: { text: string }) {
  return (
    <>
      {text.split(/(https?:\/\/[^\s]+)/g).map((part, index) =>
        part.startsWith("http://") || part.startsWith("https://") ? (
          <a
            key={`${part}-${index}`}
            href={part.replace(/[.,]$/, "")}
            className="font-bold text-brand-700 underline underline-offset-2"
            rel="noreferrer"
          >
            Complete profile
          </a>
        ) : (
          <span key={`${part}-${index}`}>{part}</span>
        ),
      )}
    </>
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
