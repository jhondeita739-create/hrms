"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useRef, useState, useTransition } from "react";
import {
  Bell,
  CalendarClock,
  CheckCircle2,
  Clock3,
  Download,
  FileCheck2,
  GraduationCap,
  KeyRound,
  LogOut,
  MapPin,
  ShieldCheck,
  UploadCloud,
  Video,
} from "lucide-react";
import { signOut } from "@/app/actions/account";
import {
  getOwnRequirementDownloadUrl,
  uploadOwnRequirement,
  type PreboardingMutationResult,
} from "@/app/actions/preboarding";
import { cn, formatDate, initials } from "@/lib/utils";
import type { EmployeeOnboardingData, PreboardingRequirement } from "@/lib/preboarding-data";
import payrollLogo from "../Payroll-logo-removebg.png";

const tone: Record<string, string> = {
  pending: "bg-slate-100 text-slate-600",
  submitted: "bg-blue-50 text-blue-700",
  under_review: "bg-violet-50 text-violet-700",
  verified: "bg-emerald-50 text-emerald-700",
  rejected: "bg-rose-50 text-rose-700",
  waived: "bg-amber-50 text-amber-700",
};

export function EmployeeOnboardingPortal({ data }: { data: EmployeeOnboardingData }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [notice, setNotice] = useState<PreboardingMutationResult | null>(null);
  const account = data.account;
  const done = account.requirements.filter((item) => ["submitted", "under_review", "verified", "waived"].includes(item.status)).length;
  const requirementProgress = account.requirements.length
    ? Math.round((done / account.requirements.length) * 100)
    : 0;

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
    <div className="min-h-screen bg-sand">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-[1500px] items-center gap-4 px-4 sm:px-6 lg:px-8">
          <Link href="/employee/onboarding" className="shrink-0">
            <Image src={payrollLogo} alt="Priority Handling Logistics, Inc." priority className="h-11 w-auto" />
          </Link>
          <div className="ml-auto flex min-w-0 items-center gap-3">
            <div className="hidden min-w-0 text-right sm:block"><p className="truncate text-xs font-bold text-slate-900">{account.employeeName}</p><p className="mt-0.5 truncate text-[11px] text-slate-500">{account.employeeNumber}</p></div>
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-100 text-xs font-black text-brand-700">{initials(account.employeeName)}</span>
            <Link href="/account/security" aria-label="Account security and MFA" title="Account security and MFA" className="grid h-9 w-9 place-items-center rounded-xl text-slate-500 transition-colors hover:bg-brand-50 hover:text-brand-700"><ShieldCheck className="h-[18px] w-[18px]" /></Link>
            <form action={signOut}><button type="submit" aria-label="Sign out" title="Sign out" className="grid h-9 w-9 place-items-center rounded-xl text-slate-500 transition-colors hover:bg-rose-50 hover:text-rose-600"><LogOut className="h-[18px] w-[18px]" /></button></form>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1500px] space-y-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
        <section className="relative overflow-hidden rounded-3xl bg-slate-950 p-6 text-white shadow-xl sm:p-8">
          <div className="absolute -right-24 -top-24 h-64 w-64 rounded-full bg-brand-500/20 blur-3xl" />
          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div><div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.14em] text-brand-300"><ShieldCheck className="h-4 w-4" />Secure employee onboarding</div><h1 className="mt-3 text-3xl font-black tracking-[-.04em] sm:text-4xl">Welcome, {account.employeeName.split(" ")[0]}</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">Submit your pre-employment documents before the deadline. Your training schedule and permanent employee access unlock automatically when every required item is received on time.</p></div>
            <div className={cn("rounded-2xl px-4 py-3 text-sm font-bold ring-1", account.accessStatus === "permanent" ? "bg-emerald-400/10 text-emerald-300 ring-emerald-400/20" : "bg-amber-400/10 text-amber-300 ring-amber-400/20")}><KeyRound className="mr-2 inline h-4 w-4" />{account.accessStatus === "permanent" ? "Permanent employee access" : "Temporary employee access"}</div>
          </div>
        </section>

        {notice && <div className={cn("rounded-2xl border px-4 py-3 text-sm font-semibold", notice.ok ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-rose-200 bg-rose-50 text-rose-800")}>{notice.message}</div>}

        <div className="grid gap-4 sm:grid-cols-3">
          <Summary icon={FileCheck2} label="Requirements submitted" value={`${done}/${account.requirements.length}`} />
          <Summary icon={Clock3} label="Submission deadline" value={formatDate(account.requirementsDueDate)} />
          <Summary icon={GraduationCap} label="Onboarding progress" value={`${data.onboardingProgress}%`} />
        </div>

        <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,.6fr)]">
          <div className="min-w-0 space-y-6">
            <section className="rounded-3xl bg-white p-5 shadow-panel ring-1 ring-slate-200/70 sm:p-7">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-bold uppercase tracking-[.14em] text-brand-600">Document center</p><h2 className="mt-2 text-xl font-extrabold text-slate-900">Required documents</h2><p className="mt-1 text-sm text-slate-500">PDF, JPG, or PNG up to 10 MB. Re-uploading creates a secure new version.</p></div><div className="min-w-44"><div className="mb-2 flex justify-between text-xs font-bold text-slate-600"><span>Submission progress</span><span>{requirementProgress}%</span></div><div className="h-2 rounded-full bg-slate-100"><div className="h-2 rounded-full bg-brand-600 transition-[width] duration-500" style={{ width: `${requirementProgress}%` }} /></div></div></div>
              <div className="mt-6 space-y-4">{account.requirements.map((item) => <EmployeeRequirementRow key={item.id} item={item} pending={pending} run={run} />)}{!account.requirements.length && <div className="rounded-2xl bg-slate-50 p-6 text-center text-sm text-slate-500">HR has not assigned any document requirements.</div>}</div>
            </section>

            {account.trainings.length > 0 && (
              <section className="rounded-3xl bg-white p-5 shadow-panel ring-1 ring-slate-200/70 sm:p-7"><div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-brand-50 text-brand-700"><GraduationCap className="h-5 w-5" /></span><div><h2 className="text-lg font-extrabold text-slate-900">Your training schedule</h2><p className="mt-1 text-xs text-slate-500">Released after successful requirement submission.</p></div></div><div className="mt-5 grid gap-4 sm:grid-cols-2">{account.trainings.map((training) => <article key={training.id} className="rounded-2xl border border-brand-100 bg-brand-50/50 p-5"><div className="flex items-start justify-between gap-3"><h3 className="text-sm font-extrabold text-brand-950">{training.title}</h3><span className="rounded-full bg-white px-2 py-1 text-[10px] font-bold capitalize text-brand-700">{training.status}</span></div><p className="mt-3 flex gap-2 text-xs font-semibold text-slate-700"><CalendarClock className="h-4 w-4 text-brand-600" />{new Date(training.scheduledStart).toLocaleString()} – {new Date(training.scheduledEnd).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p><p className="mt-2 flex gap-2 text-xs text-slate-600"><MapPin className="h-4 w-4 text-brand-600" />{training.location || "Online session"}</p>{training.description && <p className="mt-3 text-xs leading-5 text-slate-500">{training.description}</p>}{training.meetingUrl && <a href={training.meetingUrl} target="_blank" rel="noreferrer" className="mt-4 inline-flex h-9 items-center gap-2 rounded-xl bg-brand-600 px-3 text-xs font-bold text-white"><Video className="h-4 w-4" />Join meeting</a>}</article>)}</div></section>
            )}
          </div>

          <aside className="min-w-0 space-y-6">
            <section className="rounded-3xl bg-white p-5 shadow-panel ring-1 ring-slate-200/70"><div className="flex items-center gap-2"><Bell className="h-5 w-5 text-brand-600" /><h2 className="text-base font-extrabold text-slate-900">Updates</h2></div><div className="mt-4 space-y-3">{data.notifications.map((item) => <article key={item.id} className="rounded-2xl bg-slate-50 p-4"><h3 className="text-xs font-bold text-slate-800">{item.title}</h3><p className="mt-2 text-xs leading-5 text-slate-500">{item.body}</p><p className="mt-2 text-[10px] font-semibold text-slate-400">{new Date(item.createdAt).toLocaleString()}</p></article>)}{!data.notifications.length && <p className="py-6 text-center text-xs text-slate-500">No updates yet.</p>}</div></section>
            <section className="rounded-3xl bg-white p-5 shadow-panel ring-1 ring-slate-200/70"><h2 className="text-base font-extrabold text-slate-900">Onboarding checklist</h2><div className="mt-4 space-y-3">{data.tasks.map((task) => <div key={task.id} className="flex gap-3"><span className={cn("mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full", task.status === "completed" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-400")}>{task.status === "completed" ? <CheckCircle2 className="h-3.5 w-3.5" /> : <span className="h-1.5 w-1.5 rounded-full bg-current" />}</span><div><p className="text-xs font-bold text-slate-700">{task.title}</p><p className="mt-1 text-[10px] text-slate-400">{task.category}{task.dueDate ? ` · ${formatDate(task.dueDate)}` : ""}</p></div></div>)}</div></section>
          </aside>
        </div>
      </main>
    </div>
  );
}

function Summary({ icon: Icon, label, value }: { icon: typeof FileCheck2; label: string; value: string }) { return <div className="flex items-center gap-4 rounded-2xl bg-white p-5 shadow-panel ring-1 ring-slate-200/70"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-brand-50 text-brand-700"><Icon className="h-5 w-5" /></span><div><p className="text-base font-black text-slate-900">{value}</p><p className="mt-1 text-xs font-semibold text-slate-500">{label}</p></div></div>; }

function EmployeeRequirementRow({ item, pending, run }: { item: PreboardingRequirement; pending: boolean; run: (task: Promise<PreboardingMutationResult>, after?: () => void) => void }) {
  const form = useRef<HTMLFormElement>(null);
  const late = item.dueDate < new Date().toISOString().slice(0, 10) && !item.submittedAt;
  async function download() { const result = await getOwnRequirementDownloadUrl(item.id); if (result.ok && result.url) window.location.assign(result.url); else run(Promise.resolve(result)); }
  return <article className={cn("rounded-2xl border p-4 sm:p-5", late ? "border-rose-200 bg-rose-50/30" : "border-slate-200")}><div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div><div className="flex flex-wrap items-center gap-2"><h3 className="text-sm font-extrabold text-slate-900">{item.title}</h3><span className={cn("rounded-full px-2.5 py-1 text-[10px] font-bold capitalize", tone[item.status] || tone.pending)}>{item.status.replaceAll("_", " ")}</span>{item.required && <span className="text-[10px] font-bold uppercase tracking-wide text-rose-500">Required</span>}</div>{item.description && <p className="mt-2 text-xs leading-5 text-slate-500">{item.description}</p>}<p className={cn("mt-2 text-xs font-semibold", late ? "text-rose-600" : "text-slate-400")}>Due {formatDate(item.dueDate)}{late ? " · Deadline passed" : ""}</p>{item.reviewNotes && <p className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">HR note: {item.reviewNotes}</p>}</div>{item.fileName && <button type="button" onClick={download} className="inline-flex h-9 shrink-0 items-center gap-2 rounded-xl bg-slate-100 px-3 text-xs font-bold text-slate-700"><Download className="h-4 w-4" />Download</button>}</div>{item.status !== "verified" && item.status !== "waived" && <form ref={form} className="mt-4 flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center" onSubmit={(event: FormEvent<HTMLFormElement>) => { event.preventDefault(); run(uploadOwnRequirement(item.id, new FormData(event.currentTarget)), () => form.current?.reset()); }}><input name="file" type="file" required accept=".pdf,.jpg,.jpeg,.png" className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 text-xs file:mr-3 file:h-10 file:border-0 file:bg-brand-50 file:px-3 file:text-xs file:font-bold file:text-brand-700" /><button disabled={pending} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 text-xs font-bold text-white disabled:opacity-50"><UploadCloud className="h-4 w-4" />{item.fileName ? "Replace file" : "Submit document"}</button></form>}</article>;
}
