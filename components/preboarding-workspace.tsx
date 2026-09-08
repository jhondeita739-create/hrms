"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Archive,
  CheckCircle2,
  ChevronRight,
  Clock3,
  FileCheck2,
  GraduationCap,
  KeyRound,
  Mail,
  Plus,
  Save,
  ShieldAlert,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import {
  archiveEmployeeRequirement,
  archiveEmployeeTraining,
  createEmployeeRequirement,
  createEmployeeTraining,
  reviewEmployeeRequirement,
  resendEmployeeActivation,
  setEmployeeAccessStatus,
  startEmployeePreboarding,
  updateEmployeeRequirement,
  updateEmployeeTraining,
  updateRequirementsDeadline,
  type PreboardingMutationResult,
} from "@/app/actions/preboarding";
import { getDocumentDownloadUrl } from "@/app/actions/resources";
import { cn, formatDate, initials } from "@/lib/utils";
import type {
  PreboardingAccount,
  PreboardingAdminData,
  PreboardingRequirement,
  PreboardingTraining,
} from "@/lib/preboarding-data";

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

const statusTone: Record<string, string> = {
  temporary: "bg-amber-50 text-amber-700 ring-amber-200",
  permanent: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  suspended: "bg-rose-50 text-rose-700 ring-rose-200",
  pending: "bg-slate-100 text-slate-600 ring-slate-200",
  submitted: "bg-blue-50 text-blue-700 ring-blue-200",
  under_review: "bg-violet-50 text-violet-700 ring-violet-200",
  verified: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  rejected: "bg-rose-50 text-rose-700 ring-rose-200",
  waived: "bg-amber-50 text-amber-700 ring-amber-200",
  pending_requirements: "bg-amber-50 text-amber-700 ring-amber-200",
  scheduled: "bg-blue-50 text-blue-700 ring-blue-200",
  completed: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  cancelled: "bg-slate-100 text-slate-600 ring-slate-200",
  activated: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  unknown: "bg-slate-100 text-slate-600 ring-slate-200",
};

function Status({ value }: { value: string }) {
  return (
    <span className={cn("inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold capitalize ring-1 ring-inset", statusTone[value] || statusTone.pending)}>
      {value.replaceAll("_", " ")}
    </span>
  );
}

function EmployeeAvatar({ account, className }: { account: PreboardingAccount; className: string }) {
  return (
    <span
      role="img"
      aria-label={`${account.employeeName} profile image`}
      className={cn(
        "grid shrink-0 place-items-center bg-brand-100 bg-cover bg-center font-black text-brand-700 ring-1 ring-slate-200",
        className,
      )}
      style={account.avatarUrl ? { backgroundImage: `url(${JSON.stringify(account.avatarUrl)})` } : undefined}
    >
      {!account.avatarUrl && initials(account.employeeName)}
    </span>
  );
}

export function PreboardingWorkspace({ data }: { data: PreboardingAdminData }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [selectedId, setSelectedId] = useState(data.accounts[0]?.id || "");
  const [createOpen, setCreateOpen] = useState(false);
  const [notice, setNotice] = useState<PreboardingMutationResult | null>(null);
  const selected = useMemo(
    () => data.accounts.find((account) => account.id === selectedId) || data.accounts[0],
    [data.accounts, selectedId],
  );
  const temporary = data.accounts.filter((item) => item.accessStatus === "temporary").length;
  const permanent = data.accounts.filter((item) => item.accessStatus === "permanent").length;
  const overdue = data.accounts.reduce(
    (count, account) =>
      count + account.requirements.filter((item) => item.status === "pending" && item.dueDate < inputDate(0)).length,
    0,
  );

  function run(task: Promise<PreboardingMutationResult>, after?: () => void) {
    startTransition(async () => {
      const result = await task;
      setNotice(result);
      if (result.ok) {
        after?.();
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-[.16em] text-brand-600">Recruitment to employee</p>
          <h1 className="text-3xl font-extrabold tracking-[-.04em] text-slate-900 sm:text-4xl">Employee preboarding</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500 sm:text-base">
            Issue temporary access, collect requirements, release training schedules, and promote qualified new hires.
          </p>
        </div>
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            if (data.hiredApplications.length) {
              setCreateOpen(true);
              return;
            }
            setNotice({
              ok: true,
              message: "All hired applicants already have temporary accounts. Select an account below to manage or resend its activation email.",
            });
          }}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-brand-600 px-5 text-sm font-bold text-white shadow-sm transition hover:bg-brand-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <UserPlus className="h-4 w-4" />
          {data.hiredApplications.length ? "Create temporary account" : "All accounts created"}
        </button>
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        <Metric icon={KeyRound} label="Temporary access" value={temporary} tone="amber" />
        <Metric icon={CheckCircle2} label="Permanent access" value={permanent} tone="emerald" />
        <Metric icon={Clock3} label="Overdue requirements" value={overdue} tone="rose" />
      </div>

      {notice && (
        <div className={cn("flex items-center justify-between rounded-2xl border px-4 py-3 text-sm font-semibold", notice.ok ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-rose-200 bg-rose-50 text-rose-800")}>
          <span>{notice.message}</span>
          <button type="button" aria-label="Dismiss" onClick={() => setNotice(null)}><X className="h-4 w-4" /></button>
        </div>
      )}

      <div className="grid min-w-0 gap-6 xl:grid-cols-[340px_minmax(0,1fr)]">
        <section className="overflow-hidden rounded-3xl bg-white shadow-panel ring-1 ring-slate-200/70">
          <div className="border-b border-slate-100 p-5">
            <h2 className="text-sm font-extrabold text-slate-900">New hire accounts</h2>
            <p className="mt-1 text-xs text-slate-500">{data.accounts.length} lifecycle records</p>
          </div>
          <div className="max-h-[680px] overflow-y-auto p-2">
            {data.accounts.map((account) => (
              <button
                type="button"
                key={account.id}
                onClick={() => setSelectedId(account.id)}
                className={cn("flex w-full items-center gap-3 rounded-2xl p-3 text-left transition-colors", selected?.id === account.id ? "bg-brand-50" : "hover:bg-slate-50")}
              >
                <EmployeeAvatar account={account} className="h-10 w-10 rounded-xl text-xs" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold text-slate-900">{account.employeeName}</span>
                  <span className="mt-1 block truncate text-xs text-slate-500">{account.position}</span>
                </span>
                <ChevronRight className="h-4 w-4 text-slate-300" />
              </button>
            ))}
            {!data.accounts.length && (
              <div className="grid min-h-48 place-items-center px-5 text-center">
                <div><Users className="mx-auto h-7 w-7 text-slate-300" /><p className="mt-3 text-sm font-bold text-slate-700">No preboarding accounts</p><p className="mt-1 text-xs leading-5 text-slate-500">Mark an application hired, then create temporary access.</p></div>
              </div>
            )}
          </div>
        </section>

        {selected ? (
          <div className="min-w-0 space-y-6">
            <AccountSummary account={selected} pending={pending} run={run} />
            <RequirementsSection account={selected} documentTypes={data.documentTypes} pending={pending} run={run} />
            <TrainingSection account={selected} pending={pending} run={run} />
          </div>
        ) : (
          <div className="grid min-h-96 place-items-center rounded-3xl border border-dashed border-slate-300 bg-white/60 p-8 text-center text-sm text-slate-500">Select or create a preboarding account to manage its workflow.</div>
        )}
      </div>

      {createOpen && (
        <CreateAccountDialog
          applications={data.hiredApplications}
          pending={pending}
          onClose={() => setCreateOpen(false)}
          onSubmit={(values) => run(startEmployeePreboarding(values), () => setCreateOpen(false))}
        />
      )}
    </div>
  );
}

function Metric({ icon: Icon, label, value, tone }: { icon: typeof KeyRound; label: string; value: number; tone: "amber" | "emerald" | "rose" }) {
  const color = { amber: "bg-amber-50 text-amber-600", emerald: "bg-emerald-50 text-emerald-600", rose: "bg-rose-50 text-rose-600" }[tone];
  return <div className="flex items-center gap-4 rounded-2xl bg-white p-5 shadow-panel ring-1 ring-slate-200/70"><span className={cn("grid h-11 w-11 place-items-center rounded-2xl", color)}><Icon className="h-5 w-5" /></span><div><div className="text-2xl font-black text-slate-900">{value}</div><div className="text-xs font-semibold text-slate-500">{label}</div></div></div>;
}

function AccountSummary({ account, pending, run }: { account: PreboardingAccount; pending: boolean; run: (task: Promise<PreboardingMutationResult>, after?: () => void) => void }) {
  return (
    <section className="rounded-3xl bg-white p-5 shadow-panel ring-1 ring-slate-200/70 sm:p-7">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <EmployeeAvatar account={account} className="h-14 w-14 rounded-2xl text-base" />
          <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h2 className="truncate text-xl font-extrabold text-slate-900">{account.employeeName}</h2><Status value={account.accessStatus} /></div><p className="mt-1 truncate text-sm text-slate-500">{account.employeeNumber} · {account.email}</p><p className="mt-1 text-xs font-semibold text-slate-400">{account.position}</p></div>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          {account.activationStatus !== "activated" && account.accessStatus === "temporary" && (
            <button type="button" disabled={pending} onClick={() => run(resendEmployeeActivation(account.id))} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-brand-50 px-4 text-xs font-bold text-brand-700 hover:bg-brand-100 disabled:opacity-50"><Mail className="h-4 w-4" /> Resend activation email</button>
          )}
          {account.accessStatus !== "permanent" && (
            <button type="button" disabled={pending} onClick={() => run(setEmployeeAccessStatus(account.id, account.accessStatus === "suspended" ? "temporary" : "suspended"))} className={cn("inline-flex h-10 items-center justify-center gap-2 rounded-xl px-4 text-xs font-bold", account.accessStatus === "suspended" ? "bg-brand-50 text-brand-700" : "bg-rose-50 text-rose-700")}><ShieldAlert className="h-4 w-4" />{account.accessStatus === "suspended" ? "Restore access" : "Suspend access"}</button>
          )}
        </div>
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-5 text-xs font-semibold text-slate-500">
        <Mail className="h-4 w-4 text-brand-500" />
        Password setup:
        <Status value={account.activationStatus} />
        {account.lastSignInAt && <span>Last authentication activity {formatDate(account.lastSignInAt)}</span>}
      </div>
      <form className="mt-6 flex flex-col gap-3 rounded-2xl bg-slate-50 p-4 sm:flex-row sm:items-end" onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); run(updateRequirementsDeadline(account.id, String(form.get("deadline")))); }}>
        <label className="min-w-0 flex-1 text-xs font-bold text-slate-600">Requirements deadline<input name="deadline" type="date" required defaultValue={account.requirementsDueDate} className="field-control mt-2 bg-white" /></label>
        <button disabled={pending} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 text-xs font-bold text-white"><Save className="h-4 w-4" /> Update deadline</button>
      </form>
    </section>
  );
}

function RequirementsSection({ account, documentTypes, pending, run }: { account: PreboardingAccount; documentTypes: PreboardingAdminData["documentTypes"]; pending: boolean; run: (task: Promise<PreboardingMutationResult>, after?: () => void) => void }) {
  const [adding, setAdding] = useState(false);
  return (
    <section className="rounded-3xl bg-white p-5 shadow-panel ring-1 ring-slate-200/70 sm:p-7">
      <div className="flex items-center justify-between gap-4"><div><h2 className="flex items-center gap-2 text-base font-extrabold text-slate-900"><FileCheck2 className="h-5 w-5 text-brand-600" /> Required documents</h2><p className="mt-1 text-xs text-slate-500">Create, review, revise, and archive new-hire requirements.</p></div><button type="button" onClick={() => setAdding(!adding)} className="inline-flex h-10 items-center gap-2 rounded-xl bg-brand-50 px-4 text-xs font-bold text-brand-700"><Plus className="h-4 w-4" /> Add</button></div>
      {adding && <RequirementForm documentTypes={documentTypes} dueDate={account.requirementsDueDate} pending={pending} submitLabel="Add requirement" onSubmit={(value) => run(createEmployeeRequirement({ lifecycleId: account.id, ...value }), () => setAdding(false))} />}
      <div className="mt-5 space-y-3">
        {account.requirements.map((item) => <RequirementRow key={item.id} item={item} documentTypes={documentTypes} pending={pending} run={run} />)}
        {!account.requirements.length && <Empty text="No active requirements." />}
      </div>
    </section>
  );
}

type RequirementValue = { title: string; description: string; dueDate: string; documentTypeId: string; required: boolean };

function RequirementForm({ item, documentTypes, dueDate, pending, submitLabel, onSubmit }: { item?: PreboardingRequirement; documentTypes: PreboardingAdminData["documentTypes"]; dueDate: string; pending: boolean; submitLabel: string; onSubmit: (value: RequirementValue) => void }) {
  return (
    <form className="mt-5 grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2" onSubmit={(event) => { event.preventDefault(); const data = new FormData(event.currentTarget); onSubmit({ title: String(data.get("title")), description: String(data.get("description") || ""), dueDate: String(data.get("dueDate")), documentTypeId: String(data.get("documentTypeId") || ""), required: data.get("required") === "on" }); }}>
      <label className="text-xs font-bold text-slate-600">Requirement<input name="title" required defaultValue={item?.title} className="field-control mt-2 bg-white" /></label>
      <label className="text-xs font-bold text-slate-600">Document type<select name="documentTypeId" defaultValue={item?.documentTypeId || ""} className="field-control mt-2 bg-white"><option value="">Unspecified</option>{documentTypes.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}</select></label>
      <label className="text-xs font-bold text-slate-600">Due date<input name="dueDate" type="date" required defaultValue={item?.dueDate || dueDate} className="field-control mt-2 bg-white" /></label>
      <label className="flex items-center gap-2 self-end pb-3 text-xs font-bold text-slate-600"><input name="required" type="checkbox" defaultChecked={item?.required ?? true} className="h-4 w-4 rounded border-slate-300 text-brand-600" /> Required for permanent access</label>
      <label className="text-xs font-bold text-slate-600 sm:col-span-2">Instructions<textarea name="description" defaultValue={item?.description || ""} rows={2} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500" /></label>
      <button disabled={pending} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 text-xs font-bold text-white sm:col-start-2 sm:justify-self-end"><Save className="h-4 w-4" />{submitLabel}</button>
    </form>
  );
}

function RequirementRow({ item, documentTypes, pending, run }: { item: PreboardingRequirement; documentTypes: PreboardingAdminData["documentTypes"]; pending: boolean; run: (task: Promise<PreboardingMutationResult>, after?: () => void) => void }) {
  const [editing, setEditing] = useState(false);
  const [notes, setNotes] = useState(item.reviewNotes || "");
  async function download() {
    if (!item.documentId) return;
    const result = await getDocumentDownloadUrl(item.documentId);
    if (result.ok && result.url) window.location.assign(result.url);
    else setNotes(result.message);
  }
  return (
    <article className="rounded-2xl border border-slate-200 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><div className="flex flex-wrap items-center gap-2"><h3 className="text-sm font-bold text-slate-900">{item.title}</h3><Status value={item.status} /></div><p className="mt-1 text-xs text-slate-500">Due {formatDate(item.dueDate)}{item.fileName ? ` · ${item.fileName}` : " · Awaiting upload"}</p></div><div className="flex gap-2">{item.documentId && <button type="button" onClick={download} className="h-9 rounded-xl bg-brand-50 px-3 text-xs font-bold text-brand-700">Download</button>}<button type="button" onClick={() => setEditing(!editing)} className="h-9 rounded-xl bg-slate-100 px-3 text-xs font-bold text-slate-700">Edit</button><button type="button" disabled={pending} onClick={() => run(archiveEmployeeRequirement(item.id))} aria-label="Archive requirement" className="grid h-9 w-9 place-items-center rounded-xl bg-rose-50 text-rose-600"><Archive className="h-4 w-4" /></button></div></div>
      {editing && <RequirementForm item={item} documentTypes={documentTypes} dueDate={item.dueDate} pending={pending} submitLabel="Save requirement" onSubmit={(value) => run(updateEmployeeRequirement(item.id, value), () => setEditing(false))} />}
      {item.status !== "waived" && (
        <div className="mt-4 grid gap-2 border-t border-slate-100 pt-4 sm:grid-cols-[1fr_auto]">
          <input value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Reviewer notes" className="field-control" />
          <div>
            {!item.documentId && <p className="mb-2 text-[11px] font-semibold text-amber-700">Awaiting an uploaded file. Use Waive only when a document is not required.</p>}
            <div className="flex flex-wrap gap-2"><button disabled={pending || !item.documentId} title={!item.documentId ? "A document must be uploaded before verification" : "Verify submitted document"} onClick={() => run(reviewEmployeeRequirement(item.id, "verified", notes))} className="h-11 rounded-xl bg-emerald-50 px-3 text-xs font-bold text-emerald-700 disabled:cursor-not-allowed disabled:opacity-45">Verify</button><button disabled={pending || !item.documentId} title={!item.documentId ? "A document must be uploaded before rejection" : "Reject submitted document"} onClick={() => run(reviewEmployeeRequirement(item.id, "rejected", notes))} className="h-11 rounded-xl bg-rose-50 px-3 text-xs font-bold text-rose-700 disabled:cursor-not-allowed disabled:opacity-45">Reject</button><button disabled={pending} onClick={() => run(reviewEmployeeRequirement(item.id, "waived", notes))} className="h-11 rounded-xl bg-amber-50 px-3 text-xs font-bold text-amber-700 disabled:opacity-50">Waive</button></div>
          </div>
        </div>
      )}
    </article>
  );
}

function TrainingSection({ account, pending, run }: { account: PreboardingAccount; pending: boolean; run: (task: Promise<PreboardingMutationResult>, after?: () => void) => void }) {
  const [adding, setAdding] = useState(false);
  return (
    <section className="rounded-3xl bg-white p-5 shadow-panel ring-1 ring-slate-200/70 sm:p-7">
      <div className="flex items-center justify-between gap-4"><div><h2 className="flex items-center gap-2 text-base font-extrabold text-slate-900"><GraduationCap className="h-5 w-5 text-brand-600" /> Training schedules</h2><p className="mt-1 text-xs text-slate-500">Schedules remain hidden until all required files arrive on time.</p></div><button type="button" onClick={() => setAdding(!adding)} className="inline-flex h-10 items-center gap-2 rounded-xl bg-brand-50 px-4 text-xs font-bold text-brand-700"><Plus className="h-4 w-4" /> Add</button></div>
      {adding && <TrainingForm pending={pending} submitLabel="Add schedule" onSubmit={(value) => run(createEmployeeTraining({ lifecycleId: account.id, ...value }), () => setAdding(false))} />}
      <div className="mt-5 space-y-3">{account.trainings.map((item) => <TrainingRow key={item.id} item={item} pending={pending} run={run} />)}{!account.trainings.length && <Empty text="No active training schedules." />}</div>
    </section>
  );
}

type TrainingValue = { title: string; description: string; trainingType: string; scheduledStart: string; scheduledEnd: string; timezone: string; location: string; meetingUrl: string };

function TrainingForm({ item, pending, submitLabel, onSubmit }: { item?: PreboardingTraining; pending: boolean; submitLabel: string; onSubmit: (value: TrainingValue) => void }) {
  return (
    <form className="mt-5 grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2" onSubmit={(event) => { event.preventDefault(); const data = new FormData(event.currentTarget); onSubmit({ title: String(data.get("title")), description: String(data.get("description") || ""), trainingType: String(data.get("trainingType")), scheduledStart: String(data.get("scheduledStart")), scheduledEnd: String(data.get("scheduledEnd")), timezone: String(data.get("timezone")), location: String(data.get("location") || ""), meetingUrl: String(data.get("meetingUrl") || "") }); }}>
      <label className="text-xs font-bold text-slate-600">Title<input name="title" required defaultValue={item?.title || "New hire orientation"} className="field-control mt-2 bg-white" /></label><label className="text-xs font-bold text-slate-600">Type<input name="trainingType" required defaultValue={item?.trainingType || "orientation"} className="field-control mt-2 bg-white" /></label>
      <label className="text-xs font-bold text-slate-600">Starts<input name="scheduledStart" type="datetime-local" required defaultValue={item ? item.scheduledStart.slice(0, 16) : inputDateTime(9, 9)} className="field-control mt-2 bg-white" /></label><label className="text-xs font-bold text-slate-600">Ends<input name="scheduledEnd" type="datetime-local" required defaultValue={item ? item.scheduledEnd.slice(0, 16) : inputDateTime(9, 12)} className="field-control mt-2 bg-white" /></label>
      <label className="text-xs font-bold text-slate-600">Timezone<input name="timezone" required defaultValue={item?.timezone || "Asia/Manila"} className="field-control mt-2 bg-white" /></label><label className="text-xs font-bold text-slate-600">Location<input name="location" defaultValue={item?.location || ""} className="field-control mt-2 bg-white" /></label>
      <label className="text-xs font-bold text-slate-600 sm:col-span-2">Meeting URL<input name="meetingUrl" type="url" defaultValue={item?.meetingUrl || ""} className="field-control mt-2 bg-white" /></label><label className="text-xs font-bold text-slate-600 sm:col-span-2">Description<textarea name="description" defaultValue={item?.description || ""} rows={2} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" /></label>
      <button disabled={pending} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 text-xs font-bold text-white sm:col-start-2 sm:justify-self-end"><Save className="h-4 w-4" />{submitLabel}</button>
    </form>
  );
}

function TrainingRow({ item, pending, run }: { item: PreboardingTraining; pending: boolean; run: (task: Promise<PreboardingMutationResult>, after?: () => void) => void }) {
  const [editing, setEditing] = useState(false);
  return <article className="rounded-2xl border border-slate-200 p-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><div className="flex flex-wrap items-center gap-2"><h3 className="text-sm font-bold text-slate-900">{item.title}</h3><Status value={item.status} /></div><p className="mt-1 text-xs text-slate-500">{new Date(item.scheduledStart).toLocaleString()} · {item.location || "Online"}</p></div><div className="flex gap-2"><button type="button" onClick={() => setEditing(!editing)} className="h-9 rounded-xl bg-slate-100 px-3 text-xs font-bold text-slate-700">Edit</button><button type="button" disabled={pending} onClick={() => run(archiveEmployeeTraining(item.id))} className="grid h-9 w-9 place-items-center rounded-xl bg-rose-50 text-rose-600"><Archive className="h-4 w-4" /></button></div></div>{editing && <TrainingForm item={item} pending={pending} submitLabel="Save schedule" onSubmit={(value) => run(updateEmployeeTraining(item.id, { ...value, status: item.status as "pending_requirements" | "scheduled" | "completed" | "cancelled" }), () => setEditing(false))} />}{item.status === "scheduled" && <button type="button" disabled={pending} onClick={() => run(updateEmployeeTraining(item.id, { title: item.title, description: item.description || "", trainingType: item.trainingType, scheduledStart: item.scheduledStart, scheduledEnd: item.scheduledEnd, timezone: item.timezone, location: item.location || "", meetingUrl: item.meetingUrl || "", status: "completed" }))} className="mt-4 h-10 rounded-xl bg-emerald-50 px-4 text-xs font-bold text-emerald-700">Mark completed</button>}</article>;
}

function CreateAccountDialog({ applications, pending, onClose, onSubmit }: { applications: PreboardingAdminData["hiredApplications"]; pending: boolean; onClose: () => void; onSubmit: (value: Parameters<typeof startEmployeePreboarding>[0]) => void }) {
  return <div className="fixed inset-0 z-[80] grid place-items-center overflow-y-auto bg-slate-950/40 p-4 backdrop-blur-sm"><form className="my-6 w-full max-w-2xl rounded-3xl bg-white p-5 shadow-2xl sm:p-7" onSubmit={(event) => { event.preventDefault(); const data = new FormData(event.currentTarget); onSubmit({ applicationId: String(data.get("applicationId")), startDate: String(data.get("startDate")), requirementsDueDate: String(data.get("requirementsDueDate")), trainingStart: String(data.get("trainingStart")), trainingEnd: String(data.get("trainingEnd")), timezone: String(data.get("timezone")), location: String(data.get("location") || ""), meetingUrl: String(data.get("meetingUrl") || "") }); }}><div className="flex items-start justify-between"><div><h2 className="text-xl font-extrabold text-slate-900">Create temporary employee account</h2><p className="mt-1 text-sm text-slate-500">An invitation and private requirement workspace will be created.</p></div><button type="button" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-xl bg-slate-100 text-slate-500"><X className="h-4 w-4" /></button></div><div className="mt-6 grid gap-4 sm:grid-cols-2"><label className="text-xs font-bold text-slate-600 sm:col-span-2">Hired application<select name="applicationId" required className="field-control mt-2 bg-white"><option value="">Select a hired applicant</option>{applications.map((item) => <option key={item.id} value={item.id}>{item.label} · {item.email}</option>)}</select></label><label className="text-xs font-bold text-slate-600">Employment start<input name="startDate" type="date" required defaultValue={inputDate(14)} className="field-control mt-2 bg-white" /></label><label className="text-xs font-bold text-slate-600">Requirements due<input name="requirementsDueDate" type="date" required defaultValue={inputDate(7)} className="field-control mt-2 bg-white" /></label><label className="text-xs font-bold text-slate-600">Training starts<input name="trainingStart" type="datetime-local" required defaultValue={inputDateTime(9, 9)} className="field-control mt-2 bg-white" /></label><label className="text-xs font-bold text-slate-600">Training ends<input name="trainingEnd" type="datetime-local" required defaultValue={inputDateTime(9, 12)} className="field-control mt-2 bg-white" /></label><label className="text-xs font-bold text-slate-600">Timezone<input name="timezone" required defaultValue="Asia/Manila" className="field-control mt-2 bg-white" /></label><label className="text-xs font-bold text-slate-600">Location<input name="location" placeholder="Training room or office" className="field-control mt-2 bg-white" /></label><label className="text-xs font-bold text-slate-600 sm:col-span-2">Meeting URL (optional)<input name="meetingUrl" type="url" className="field-control mt-2 bg-white" /></label></div><div className="mt-7 flex justify-end gap-3"><button type="button" onClick={onClose} className="h-11 rounded-xl border border-slate-200 px-5 text-sm font-bold text-slate-600">Cancel</button><button disabled={pending} className="inline-flex h-11 items-center gap-2 rounded-xl bg-brand-600 px-5 text-sm font-bold text-white disabled:opacity-50"><UserPlus className="h-4 w-4" />{pending ? "Creating…" : "Create and invite"}</button></div></form></div>;
}

function Empty({ text }: { text: string }) { return <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-xs text-slate-500">{text}</div>; }
