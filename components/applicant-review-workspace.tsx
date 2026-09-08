"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, useTransition } from "react";
import {
  Archive,
  ArrowLeft,
  BrainCircuit,
  CalendarClock,
  Check,
  Download,
  FileCheck2,
  FilePlus2,
  Mail,
  Pencil,
  Plus,
  RotateCw,
  ShieldCheck,
  Sparkles,
  UserPlus,
  UserRoundCheck,
  X,
} from "lucide-react";
import {
  addApplicantDocument,
  archiveApplicantDocument,
  cancelInterview,
  createInterview,
  generateAiAssessment,
  getApplicantDocumentDownloadUrl,
  reviewAiAssessment,
  saveInterviewEvaluation,
  updateApplicantDocument,
  updateApplicationStage,
  updateInterview,
  type RecruitmentMutationResult,
} from "@/app/actions/recruitment";
import {
  hireAndStartEmployeePreboarding,
  type PreboardingMutationResult,
} from "@/app/actions/preboarding";
import type {
  ApplicantDocumentRecord,
  ApplicantInterviewRecord,
  ApplicantReviewData,
} from "@/lib/recruitment-data";
import { cn, formatDate, initials } from "@/lib/utils";

type InterviewDraft = {
  id?: string;
  type: string;
  scheduledStart: string;
  scheduledEnd: string;
  timezone: string;
  location: string;
  meetingUrl: string;
  instructions: string;
};

const emptyInterview: InterviewDraft = {
  type: "HR Interview",
  scheduledStart: "",
  scheduledEnd: "",
  timezone: "Asia/Manila",
  location: "",
  meetingUrl: "",
  instructions: "",
};

function inputDate(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function inputDateTime(days: number, hour: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(hour, 0, 0, 0);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

const tone: Record<string, string> = {
  hired: "bg-emerald-50 text-emerald-700 ring-emerald-600/15",
  sent: "bg-emerald-50 text-emerald-700 ring-emerald-600/15",
  completed: "bg-emerald-50 text-emerald-700 ring-emerald-600/15",
  verified: "bg-emerald-50 text-emerald-700 ring-emerald-600/15",
  strong_match: "bg-emerald-50 text-emerald-700 ring-emerald-600/15",
  in_progress: "bg-blue-50 text-blue-700 ring-blue-600/15",
  potential_match: "bg-blue-50 text-blue-700 ring-blue-600/15",
  scheduled: "bg-violet-50 text-violet-700 ring-violet-600/15",
  submitted: "bg-amber-50 text-amber-700 ring-amber-600/15",
  requested: "bg-amber-50 text-amber-700 ring-amber-600/15",
  under_review: "bg-amber-50 text-amber-700 ring-amber-600/15",
  manual_review: "bg-amber-50 text-amber-700 ring-amber-600/15",
  rejected: "bg-red-50 text-red-700 ring-red-600/15",
  failed: "bg-red-50 text-red-700 ring-red-600/15",
  cancelled: "bg-slate-100 text-slate-600 ring-slate-500/15",
};

function label(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function Badge({ value }: { value: string }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ring-inset",
        tone[value] || "bg-slate-100 text-slate-600 ring-slate-500/15",
      )}
    >
      {label(value)}
    </span>
  );
}

export function ApplicantReviewWorkspace({
  initialData,
}: {
  initialData: ApplicantReviewData;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [notice, setNotice] = useState<RecruitmentMutationResult | null>(null);
  const [selectedApplicationId, setSelectedApplicationId] = useState(
    initialData.applications[0]?.id || "",
  );
  const [stageId, setStageId] = useState(
    initialData.applications[0]?.stageId || "",
  );
  const [decisionReason, setDecisionReason] = useState("");
  const [showHireForm, setShowHireForm] = useState(false);
  const [showInterviewForm, setShowInterviewForm] = useState(false);
  const [interview, setInterview] = useState<InterviewDraft>(emptyInterview);
  const uploadForm = useRef<HTMLFormElement>(null);

  const application = useMemo(
    () =>
      initialData.applications.find((item) => item.id === selectedApplicationId) ||
      initialData.applications[0],
    [initialData.applications, selectedApplicationId],
  );
  const documents = initialData.documents.filter(
    (document) => !document.applicationId || document.applicationId === application?.id,
  );

  function run(
    task: Promise<RecruitmentMutationResult | PreboardingMutationResult>,
    after?: () => void,
  ) {
    startTransition(async () => {
      const result = await task;
      setNotice(result);
      if (result.ok) {
        after?.();
        router.refresh();
      }
    });
  }

  function selectApplication(id: string) {
    setSelectedApplicationId(id);
    const next = initialData.applications.find((item) => item.id === id);
    setStageId(next?.stageId || "");
    setDecisionReason("");
  }

  function editInterview(item: ApplicantInterviewRecord) {
    setInterview({
      id: item.id,
      type: item.type,
      scheduledStart: item.scheduledStart.slice(0, 16),
      scheduledEnd: item.scheduledEnd.slice(0, 16),
      timezone: item.timezone,
      location: item.location || "",
      meetingUrl: item.meetingUrl || "",
      instructions: item.instructions || "",
    });
    setShowInterviewForm(true);
  }

  function saveInterview() {
    if (!application) return;
    const payload = {
      applicationId: application.id,
      type: interview.type,
      scheduledStart: interview.scheduledStart,
      scheduledEnd: interview.scheduledEnd,
      timezone: interview.timezone,
      location: interview.location,
      meetingUrl: interview.meetingUrl,
      instructions: interview.instructions,
    };
    run(
      interview.id
        ? updateInterview(interview.id, payload)
        : createInterview(payload),
    );
    setShowInterviewForm(false);
    setInterview(emptyInterview);
  }

  if (!application)
    return (
      <EmptyReview
        name={initialData.applicant.name}
        number={initialData.applicant.number}
      />
    );

  const selectedStage = initialData.stages.find((stage) => stage.id === stageId);
  const finalDecision = ["hired", "rejected", "withdrawn"].includes(
    selectedStage?.type || "",
  );

  return (
    <div className="space-y-6">
      <Link
        href="/hr/recruitment/applicants"
        className="inline-flex items-center gap-2 text-sm font-bold text-slate-500 transition-colors hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" />
        All applicants
      </Link>

      <header className="flex flex-col gap-5 rounded-3xl bg-white p-6 shadow-[0_8px_30px_rgb(15,23,42,0.05)] ring-1 ring-slate-200/70 sm:flex-row sm:items-end sm:justify-between sm:p-8">
        <div className="flex min-w-0 items-start gap-4">
          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-brand-50 text-sm font-black text-brand-700">
            {initials(initialData.applicant.name)}
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
                {initialData.applicant.name}
              </h1>
              <Badge value={initialData.applicant.status} />
            </div>
            <p className="mt-1 text-sm font-medium text-slate-500">
              {initialData.applicant.number} · {initialData.applicant.email} · {initialData.applicant.phone}
            </p>
            <p className="mt-2 text-sm text-slate-500">
              {initialData.applicant.currentJobTitle || "Current role not provided"}
              {initialData.applicant.currentEmployer
                ? ` at ${initialData.applicant.currentEmployer}`
                : ""}
              {` · ${initialData.applicant.yearsExperience} years experience`}
            </p>
          </div>
        </div>
        {initialData.applications.length > 1 && (
          <label className="block shrink-0 text-xs font-bold text-slate-500">
            Application
            <select
              value={application.id}
              onChange={(event) => selectApplication(event.target.value)}
              className="mt-2 block h-11 min-w-64 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100"
            >
              {initialData.applications.map((item) => (
                <option value={item.id} key={item.id}>
                  {item.position} · {item.applicationNumber}
                </option>
              ))}
            </select>
          </label>
        )}
      </header>

      {notice && (
        <div
          className={cn(
            "flex items-center justify-between rounded-2xl border px-4 py-3 text-sm font-semibold",
            notice.ok
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-red-200 bg-red-50 text-red-800",
          )}
        >
          <span>{notice.message}</span>
          <button type="button" onClick={() => setNotice(null)} aria-label="Dismiss message">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(340px,.75fr)]">
        <div className="min-w-0 space-y-6">
          <section className="rounded-3xl bg-white p-6 shadow-[0_8px_30px_rgb(15,23,42,0.05)] ring-1 ring-slate-200/70 sm:p-8">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[.14em] text-brand-600">
                  {application.applicationNumber}
                </p>
                <h2 className="mt-2 text-xl font-extrabold text-slate-900">
                  {application.position}
                </h2>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Badge value={application.applicationStatus} />
                  <span className="text-xs text-slate-400">
                    Applied {formatDate(application.appliedAt)}
                  </span>
                </div>
              </div>
              <div className="w-full max-w-xl rounded-2xl bg-slate-50 p-4 lg:w-[420px]">
                <label className="text-xs font-bold text-slate-600" htmlFor="application-stage">
                  Recruitment stage
                </label>
                <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                  <select
                    id="application-stage"
                    value={stageId}
                    onChange={(event) => setStageId(event.target.value)}
                    className="h-11 min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100"
                  >
                    {initialData.stages.map((stage) => (
                      <option value={stage.id} key={stage.id}>
                        {stage.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    disabled={pending || !stageId || stageId === application.stageId}
                    onClick={() => {
                      if (selectedStage?.type === "hired") {
                        setShowHireForm(true);
                        return;
                      }
                      run(
                        updateApplicationStage({
                          applicationId: application.id,
                          stageId,
                          reason: decisionReason,
                        }),
                      );
                    }}
                    className="h-11 rounded-xl bg-brand-600 px-4 text-sm font-bold text-white transition-colors hover:bg-brand-500 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {selectedStage?.type === "hired" ? "Hire & onboard" : "Update stage"}
                  </button>
                </div>
                {finalDecision && (
                  <textarea
                    value={decisionReason}
                    onChange={(event) => setDecisionReason(event.target.value)}
                    rows={2}
                    placeholder="Decision reason or internal note"
                    className="mt-3 w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100"
                  />
                )}
                <p className="mt-2 text-[11px] leading-5 text-slate-500">
                  Interview, hired, and rejected stages create a portal notification and send email when configured.
                </p>
              </div>
            </div>
            {application.coverLetter && (
              <div className="mt-6 border-t border-slate-100 pt-6">
                <h3 className="text-sm font-bold text-slate-900">Candidate statement</h3>
                <p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-600">
                  {application.coverLetter}
                </p>
              </div>
            )}
          </section>

          <AiAssessmentSection
            applicationId={application.id}
            assessment={application.assessment}
            pending={pending}
            run={run}
          />

          <section className="rounded-3xl bg-white p-6 shadow-[0_8px_30px_rgb(15,23,42,0.05)] ring-1 ring-slate-200/70 sm:p-8">
            <SectionHeading
              icon={CalendarClock}
              title="Interviews"
              description="Schedule, revise, and retain interview history."
              action={
                <button
                  type="button"
                  onClick={() => {
                    setInterview(emptyInterview);
                    setShowInterviewForm((current) => !current);
                  }}
                  className="inline-flex h-10 items-center gap-2 rounded-xl bg-slate-900 px-4 text-xs font-bold text-white hover:bg-slate-800"
                >
                  <Plus className="h-4 w-4" /> Schedule
                </button>
              }
            />
            {showInterviewForm && (
              <InterviewForm
                value={interview}
                onChange={setInterview}
                onCancel={() => {
                  setShowInterviewForm(false);
                  setInterview(emptyInterview);
                }}
                onSave={saveInterview}
                pending={pending}
              />
            )}
            <div className="mt-6 space-y-3">
              {application.interviews.map((item) => (
                <InterviewRow
                  key={item.id}
                  item={item}
                  pending={pending}
                  onEdit={() => editInterview(item)}
                  run={run}
                />
              ))}
              {!application.interviews.length && (
                <EmptyState text="No interviews have been scheduled for this application." />
              )}
            </div>
          </section>

          <section className="rounded-3xl bg-white p-6 shadow-[0_8px_30px_rgb(15,23,42,0.05)] ring-1 ring-slate-200/70 sm:p-8">
            <SectionHeading
              icon={FileCheck2}
              title="Applicant requirements"
              description="Review, verify, download, add, or archive submitted files."
            />
            <div className="mt-6 space-y-3">
              {documents.map((document) => (
                <RequirementRow
                  key={document.id}
                  document={document}
                  pending={pending}
                  run={run}
                />
              ))}
              {!documents.length && <EmptyState text="No requirements have been submitted." />}
            </div>
            <form
              ref={uploadForm}
              className="mt-6 grid gap-3 rounded-2xl border border-dashed border-slate-300 bg-slate-50/70 p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
              onSubmit={(event) => {
                event.preventDefault();
                const formData = new FormData(event.currentTarget);
                run(addApplicantDocument(application.id, formData));
                uploadForm.current?.reset();
              }}
            >
              <p className="text-[11px] text-slate-500 sm:col-span-3">
                PDF, DOC, DOCX, JPG, or PNG up to 4 MB.
              </p>
              <label className="text-xs font-bold text-slate-600">
                Requirement name
                <input
                  name="title"
                  placeholder="e.g. Government ID"
                  className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100"
                />
              </label>
              <label className="text-xs font-bold text-slate-600">
                Secure file
                <input
                  name="file"
                  type="file"
                  required
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                  className="mt-2 block h-11 w-full rounded-xl border border-slate-200 bg-white text-xs file:mr-3 file:h-full file:border-0 file:bg-brand-50 file:px-3 file:text-xs file:font-bold file:text-brand-700"
                />
              </label>
              <input type="hidden" name="document_type" value="requirement" />
              <button
                type="submit"
                disabled={pending}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 text-xs font-bold text-white hover:bg-brand-500 disabled:opacity-50"
              >
                <FilePlus2 className="h-4 w-4" /> Upload
              </button>
            </form>
          </section>
        </div>

        <aside className="min-w-0 space-y-6">
          <section className="rounded-3xl bg-white p-6 shadow-[0_8px_30px_rgb(15,23,42,0.05)] ring-1 ring-slate-200/70">
            <SectionHeading
              icon={Mail}
              title="Applicant notifications"
              description="Portal and email delivery history."
            />
            <div className="mt-5 space-y-3">
              {application.notifications.map((notification) => (
                <article key={notification.id} className="rounded-2xl bg-slate-50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="text-sm font-bold text-slate-900">
                      {notification.subject}
                    </div>
                    <Badge value={notification.deliveryStatus} />
                  </div>
                  <p className="mt-2 text-xs leading-5 text-slate-500">
                    {notification.body}
                  </p>
                  <div className="mt-3 flex items-center justify-between text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                    <span>{notification.channel}</span>
                    <span>{formatDate(notification.queuedAt)}</span>
                  </div>
                </article>
              ))}
              {!application.notifications.length && (
                <EmptyState text="No applicant notifications have been sent yet." />
              )}
            </div>
          </section>

          <section className="rounded-3xl bg-slate-950 p-6 text-white shadow-xl">
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/10 text-brand-300">
                <ShieldCheck className="h-5 w-5" />
              </span>
              <div>
                <h2 className="text-sm font-bold">Human decision safeguard</h2>
                <p className="mt-2 text-xs leading-5 text-slate-300">
                  Match scores are advisory. Candidates remain visible regardless of score, and only an authorized reviewer can change recruitment status.
                </p>
              </div>
            </div>
          </section>
        </aside>
      </div>
      {showHireForm && (
        <HireAndPreboardDialog
          applicantName={initialData.applicant.name}
          position={application.position}
          pending={pending}
          onClose={() => setShowHireForm(false)}
          onSubmit={(values) =>
            run(
              hireAndStartEmployeePreboarding({
                ...values,
                applicationId: application.id,
                hiredStageId: stageId,
                decisionReason,
              }),
              () => setShowHireForm(false),
            )
          }
        />
      )}
    </div>
  );
}

type HireSetup = Omit<
  Parameters<typeof hireAndStartEmployeePreboarding>[0],
  "applicationId" | "hiredStageId" | "decisionReason"
>;

function HireAndPreboardDialog({
  applicantName,
  position,
  pending,
  onClose,
  onSubmit,
}: {
  applicantName: string;
  position: string;
  pending: boolean;
  onClose: () => void;
  onSubmit: (values: HireSetup) => void;
}) {
  return (
    <div className="fixed inset-0 z-[80] grid place-items-center overflow-y-auto bg-slate-950/45 p-4 backdrop-blur-sm">
      <form
        className="my-6 w-full max-w-2xl rounded-3xl bg-white p-5 shadow-2xl sm:p-7"
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          onSubmit({
            startDate: String(data.get("startDate")),
            requirementsDueDate: String(data.get("requirementsDueDate")),
            trainingStart: String(data.get("trainingStart")),
            trainingEnd: String(data.get("trainingEnd")),
            timezone: String(data.get("timezone")),
            location: String(data.get("location") || ""),
            meetingUrl: String(data.get("meetingUrl") || ""),
          });
        }}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.14em] text-emerald-600">
              <UserPlus className="h-4 w-4" /> Hire and start preboarding
            </div>
            <h2 className="mt-3 text-xl font-extrabold text-slate-900">Create temporary employee access</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              {applicantName} will be hired for {position}, receive an activation invitation, and get a private requirements workspace.
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close hiring setup" className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-500 hover:bg-slate-200">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <label className="text-xs font-bold text-slate-600">Employment start<input name="startDate" type="date" required defaultValue={inputDate(10)} className="field-control mt-2 bg-white" /></label>
          <label className="text-xs font-bold text-slate-600">Requirements due<input name="requirementsDueDate" type="date" required defaultValue={inputDate(7)} className="field-control mt-2 bg-white" /></label>
          <label className="text-xs font-bold text-slate-600">Training starts<input name="trainingStart" type="datetime-local" required defaultValue={inputDateTime(10, 9)} className="field-control mt-2 bg-white" /></label>
          <label className="text-xs font-bold text-slate-600">Training ends<input name="trainingEnd" type="datetime-local" required defaultValue={inputDateTime(10, 12)} className="field-control mt-2 bg-white" /></label>
          <label className="text-xs font-bold text-slate-600">Timezone<input name="timezone" required defaultValue="Asia/Manila" className="field-control mt-2 bg-white" /></label>
          <label className="text-xs font-bold text-slate-600">Location<input name="location" placeholder="Training room or office" className="field-control mt-2 bg-white" /></label>
          <label className="text-xs font-bold text-slate-600 sm:col-span-2">Meeting URL (optional)<input name="meetingUrl" type="url" className="field-control mt-2 bg-white" /></label>
        </div>

        <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-800">
          A completed interview evaluation is required. The hiring decision and HR records are committed together; if setup fails, the new invitation is revoked.
        </div>
        <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} className="h-11 rounded-xl border border-slate-200 px-5 text-sm font-bold text-slate-600">Cancel</button>
          <button disabled={pending} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 text-sm font-bold text-white hover:bg-emerald-500 disabled:opacity-50">
            <UserPlus className="h-4 w-4" /> {pending ? "Creating..." : "Confirm hire & create account"}
          </button>
        </div>
      </form>
    </div>
  );
}

function AiAssessmentSection({
  applicationId,
  assessment,
  pending,
  run,
}: {
  applicationId: string;
  assessment: ApplicantReviewData["applications"][number]["assessment"];
  pending: boolean;
  run: (task: Promise<RecruitmentMutationResult>) => void;
}) {
  const [decision, setDecision] = useState<"accepted" | "overridden">(
    assessment?.reviewDecision === "overridden" ? "overridden" : "accepted",
  );
  const [notes, setNotes] = useState(assessment?.reviewNotes || "");
  return (
    <section className="rounded-3xl bg-white p-6 shadow-[0_8px_30px_rgb(15,23,42,0.05)] ring-1 ring-slate-200/70 sm:p-8">
      <SectionHeading
        icon={BrainCircuit}
        title="AI-assisted candidate match"
        description="Explainable job-fit support using the submitted resume and vacancy criteria."
        action={
          <button
            type="button"
            disabled={pending}
            onClick={() => run(generateAiAssessment(applicationId))}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-brand-50 px-4 text-xs font-bold text-brand-700 hover:bg-brand-100 disabled:opacity-50"
          >
            {assessment ? <RotateCw className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
            {assessment ? "Recalculate" : "Generate assessment"}
          </button>
        }
      />
      {assessment ? (
        <div className="mt-6 grid gap-5 lg:grid-cols-[160px_1fr]">
          <div className="grid place-items-center rounded-2xl bg-brand-50 p-6 text-center">
            <div className="text-4xl font-black text-brand-700">{assessment.score}</div>
            <div className="mt-1 text-xs font-bold uppercase tracking-widest text-brand-500">
              out of 100
            </div>
            <div className="mt-4"><Badge value={assessment.recommendation} /></div>
          </div>
          <div>
            <p className="text-sm leading-6 text-slate-600">{assessment.summary}</p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <AssessmentList title="Evidence found" items={assessment.strengths} positive />
              <AssessmentList title="Review carefully" items={assessment.concerns} />
            </div>
            <div className="mt-5 rounded-2xl border border-slate-200 p-4">
              <div className="grid gap-3 sm:grid-cols-[150px_1fr_auto] sm:items-end">
                <label className="text-xs font-bold text-slate-600">
                  Human review
                  <select
                    value={decision}
                    onChange={(event) => setDecision(event.target.value as typeof decision)}
                    className="mt-2 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold"
                  >
                    <option value="accepted">Accepted as guidance</option>
                    <option value="overridden">Overridden</option>
                  </select>
                </label>
                <label className="text-xs font-bold text-slate-600">
                  Reviewer note
                  <input
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    placeholder="Document your independent review"
                    className="mt-2 h-10 w-full rounded-xl border border-slate-200 px-3 text-xs outline-none focus:border-brand-500"
                  />
                </label>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => run(reviewAiAssessment(assessment.id, decision, notes))}
                  className="h-10 rounded-xl bg-slate-900 px-4 text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-50"
                >
                  Save review
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-6 grid min-h-40 place-items-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 px-6 text-center">
          <div>
            <BrainCircuit className="mx-auto h-7 w-7 text-slate-300" />
            <p className="mt-3 text-sm font-bold text-slate-700">No match assessment yet</p>
            <p className="mt-1 max-w-md text-xs leading-5 text-slate-500">
              Generate an explainable score, then complete an independent human review. No applicant is hidden or automatically rejected.
            </p>
          </div>
        </div>
      )}
    </section>
  );
}

function AssessmentList({ title, items, positive }: { title: string; items: string[]; positive?: boolean }) {
  return (
    <div>
      <div className="text-xs font-bold text-slate-700">{title}</div>
      <ul className="mt-2 space-y-2">
        {(items.length ? items : ["No specific items recorded"]).map((item) => (
          <li key={item} className="flex gap-2 text-xs leading-5 text-slate-500">
            <span className={cn("mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full", positive ? "bg-emerald-500" : "bg-amber-500")} />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function InterviewRow({
  item,
  pending,
  onEdit,
  run,
}: {
  item: ApplicantInterviewRecord;
  pending: boolean;
  onEdit: () => void;
  run: (task: Promise<RecruitmentMutationResult>) => void;
}) {
  const latest = item.evaluations[0];
  const [showEvaluation, setShowEvaluation] = useState(false);
  const [recommendation, setRecommendation] = useState<
    "strong_yes" | "yes" | "mixed" | "no"
  >(
    latest?.recommendation === "strong_yes" ||
      latest?.recommendation === "yes" ||
      latest?.recommendation === "mixed" ||
      latest?.recommendation === "no"
      ? latest.recommendation
      : "yes",
  );
  const [comments, setComments] = useState(latest?.comments || "");
  return (
    <article className="rounded-2xl border border-slate-200 p-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-violet-50 text-violet-600">
          <CalendarClock className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-bold text-slate-900">{item.type}</h3>
            <Badge value={item.status} />
            {latest && <Badge value={latest.recommendation} />}
          </div>
          <p className="mt-1 text-xs text-slate-500">
            {new Date(item.scheduledStart).toLocaleString()} · {item.timezone}
          </p>
          {(item.location || item.meetingUrl) && (
            <p className="mt-1 truncate text-xs text-slate-400">
              {item.location || item.meetingUrl}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-1 self-end sm:self-auto">
          <button
            type="button"
            disabled={pending || item.status === "cancelled"}
            onClick={() => setShowEvaluation((current) => !current)}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-xs font-bold text-slate-500 hover:bg-emerald-50 hover:text-emerald-700 disabled:opacity-40"
          >
            <Check className="h-4 w-4" /> Evaluate
          </button>
          <button
            type="button"
            disabled={pending || item.status === "cancelled"}
            onClick={onEdit}
            aria-label="Edit interview"
            className="grid h-9 w-9 place-items-center rounded-xl text-slate-400 hover:bg-brand-50 hover:text-brand-700 disabled:opacity-40"
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            type="button"
            disabled={pending || item.status === "cancelled"}
            onClick={() => run(cancelInterview(item.id))}
            aria-label="Cancel interview"
            className="grid h-9 w-9 place-items-center rounded-xl text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
          >
            <Archive className="h-4 w-4" />
          </button>
        </div>
      </div>
      {latest?.comments && !showEvaluation && (
        <p className="mt-4 rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-600">
          {latest.comments}
        </p>
      )}
      {showEvaluation && (
        <div className="mt-4 grid gap-3 border-t border-slate-100 pt-4 sm:grid-cols-[150px_1fr_auto] sm:items-end">
          <label className="text-xs font-bold text-slate-600">
            Recommendation
            <select
              value={recommendation}
              onChange={(event) =>
                setRecommendation(event.target.value as typeof recommendation)
              }
              className="mt-2 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold"
            >
              <option value="strong_yes">Strong yes</option>
              <option value="yes">Yes</option>
              <option value="mixed">Mixed</option>
              <option value="no">No</option>
            </select>
          </label>
          <label className="text-xs font-bold text-slate-600">
            Evidence-based comments
            <input
              value={comments}
              onChange={(event) => setComments(event.target.value)}
              className="mt-2 h-10 w-full rounded-xl border border-slate-200 px-3 text-xs outline-none focus:border-brand-500"
              placeholder="Record observations from the interview"
            />
          </label>
          <button
            type="button"
            disabled={pending || comments.trim().length < 3}
            onClick={() => {
              run(saveInterviewEvaluation(item.id, { recommendation, comments }));
              setShowEvaluation(false);
            }}
            className="h-10 rounded-xl bg-emerald-600 px-4 text-xs font-bold text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            Save evaluation
          </button>
        </div>
      )}
    </article>
  );
}

function RequirementRow({
  document,
  pending,
  run,
}: {
  document: ApplicantDocumentRecord;
  pending: boolean;
  run: (task: Promise<RecruitmentMutationResult>) => void;
}) {
  const [status, setStatus] = useState(document.verificationStatus);
  const [notes, setNotes] = useState(document.notes || "");
  async function download() {
    const result = await getApplicantDocumentDownloadUrl(document.id);
    if (result.ok && result.url) window.location.assign(result.url);
    else run(Promise.resolve(result));
  }
  return (
    <article className="rounded-2xl border border-slate-200 p-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600">
          <FileCheck2 className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-sm font-bold text-slate-900">{document.title}</h3>
            <Badge value={document.verificationStatus} />
          </div>
          <p className="mt-1 truncate text-xs text-slate-400">
            {document.fileName} · {document.fileSize ? `${Math.ceil(document.fileSize / 1024)} KB` : "Size unavailable"}
          </p>
        </div>
        <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-[140px_1fr_auto]">
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold"
          >
            {['submitted', 'under_review', 'verified', 'rejected'].map((value) => (
              <option value={value} key={value}>{label(value)}</option>
            ))}
          </select>
          <input
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Verification note"
            className="h-10 min-w-0 rounded-xl border border-slate-200 px-3 text-xs outline-none focus:border-brand-500"
          />
          <button
            type="button"
            disabled={pending}
            onClick={() => run(updateApplicantDocument(document.id, status as "submitted" | "under_review" | "verified" | "rejected", notes))}
            className="h-10 rounded-xl bg-brand-50 px-3 text-xs font-bold text-brand-700 hover:bg-brand-100 disabled:opacity-50"
          >
            Save
          </button>
        </div>
        <div className="flex gap-1 self-end lg:self-auto">
          <button
            type="button"
            onClick={download}
            aria-label="Download requirement"
            className="grid h-9 w-9 place-items-center rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <Download className="h-4 w-4" />
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => run(archiveApplicantDocument(document.id))}
            aria-label="Archive requirement"
            className="grid h-9 w-9 place-items-center rounded-xl text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
          >
            <Archive className="h-4 w-4" />
          </button>
        </div>
      </div>
    </article>
  );
}

function InterviewForm({
  value,
  onChange,
  onCancel,
  onSave,
  pending,
}: {
  value: InterviewDraft;
  onChange: (next: InterviewDraft) => void;
  onCancel: () => void;
  onSave: () => void;
  pending: boolean;
}) {
  function update(key: keyof InterviewDraft, next: string) {
    onChange({ ...value, [key]: next });
  }
  return (
    <div className="mt-6 rounded-2xl border border-brand-100 bg-brand-50/40 p-4 sm:p-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <FormLabel label="Interview type">
          <input value={value.type} onChange={(event) => update("type", event.target.value)} />
        </FormLabel>
        <FormLabel label="Timezone">
          <input value={value.timezone} onChange={(event) => update("timezone", event.target.value)} />
        </FormLabel>
        <FormLabel label="Start">
          <input type="datetime-local" value={value.scheduledStart} onChange={(event) => update("scheduledStart", event.target.value)} />
        </FormLabel>
        <FormLabel label="End">
          <input type="datetime-local" value={value.scheduledEnd} onChange={(event) => update("scheduledEnd", event.target.value)} />
        </FormLabel>
        <FormLabel label="Location">
          <input value={value.location} onChange={(event) => update("location", event.target.value)} placeholder="Office or room" />
        </FormLabel>
        <FormLabel label="Meeting URL">
          <input type="url" value={value.meetingUrl} onChange={(event) => update("meetingUrl", event.target.value)} placeholder="https://…" />
        </FormLabel>
      </div>
      <label className="mt-4 block text-xs font-bold text-slate-600">
        Applicant instructions
        <textarea
          rows={3}
          value={value.instructions}
          onChange={(event) => update("instructions", event.target.value)}
          className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100"
        />
      </label>
      <div className="mt-4 flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="h-10 rounded-xl border border-slate-200 bg-white px-4 text-xs font-bold text-slate-600">Cancel</button>
        <button type="button" disabled={pending || !value.scheduledStart || !value.scheduledEnd} onClick={onSave} className="h-10 rounded-xl bg-brand-600 px-4 text-xs font-bold text-white disabled:opacity-50">{value.id ? "Save changes" : "Schedule interview"}</button>
      </div>
    </div>
  );
}

function FormLabel({ label: text, children }: { label: string; children: React.ReactElement<{ className?: string }> }) {
  return (
    <label className="text-xs font-bold text-slate-600">
      {text}
      <span className="mt-2 block [&>input]:h-11 [&>input]:w-full [&>input]:rounded-xl [&>input]:border [&>input]:border-slate-200 [&>input]:bg-white [&>input]:px-3 [&>input]:text-sm [&>input]:outline-none focus-within:[&>input]:border-brand-500 focus-within:[&>input]:ring-4 focus-within:[&>input]:ring-brand-100">
        {children}
      </span>
    </label>
  );
}

function SectionHeading({ icon: Icon, title, description, action }: { icon: typeof Mail; title: string; description: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-slate-50 text-slate-500">
          <Icon className="h-5 w-5" />
        </span>
        <div>
          <h2 className="text-lg font-extrabold text-slate-900">{title}</h2>
          <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p>
        </div>
      </div>
      {action}
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 px-5 py-8 text-center text-xs text-slate-500">{text}</div>;
}

function EmptyReview({ name, number }: { name: string; number: string }) {
  return (
    <div className="rounded-3xl bg-white p-10 text-center shadow-sm ring-1 ring-slate-200">
      <UserRoundCheck className="mx-auto h-9 w-9 text-brand-500" />
      <h1 className="mt-4 text-xl font-bold text-slate-900">{name}</h1>
      <p className="mt-2 text-sm text-slate-500">{number} has no job applications to review.</p>
      <Link href="/hr/recruitment/applicants" className="mt-6 inline-flex h-11 items-center rounded-xl bg-slate-900 px-5 text-sm font-bold text-white">Return to applicants</Link>
    </div>
  );
}
