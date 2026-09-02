"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import {
  DragDropProvider,
  type DragEndEvent,
  useDraggable,
  useDroppable,
} from "@dnd-kit/react";
import {
  ArrowUpRight,
  BriefcaseBusiness,
  Check,
  CircleCheck,
  Clock3,
  GripVertical,
  Sparkles,
  Star,
  UsersRound,
} from "lucide-react";
import {
  moveApplicationStage,
  toggleOnboardingTask,
} from "@/app/actions/dashboard";
import type {
  ApplicantBoardColumn,
  ApplicantBoardItem,
  DashboardOnboarding,
} from "@/lib/hr-data";
import { cn, formatDate, initials } from "@/lib/utils";

const columns: Array<{
  id: ApplicantBoardColumn;
  title: string;
  description: string;
  icon: typeof UsersRound;
  tone: string;
  bgTone: string;
  borderTone: string;
}> = [
  {
    id: "new",
    title: "New",
    description: "Ready for review",
    icon: Sparkles,
    tone: "text-blue-600 bg-blue-100",
    bgTone: "bg-blue-50/50",
    borderTone: "border-blue-100",
  },
  {
    id: "interviewing",
    title: "Interviewing",
    description: "Active selection",
    icon: UsersRound,
    tone: "text-violet-600 bg-violet-100",
    bgTone: "bg-violet-50/50",
    borderTone: "border-violet-100",
  },
  {
    id: "hired",
    title: "Hired",
    description: "Offer accepted",
    icon: CircleCheck,
    tone: "text-emerald-600 bg-emerald-100",
    bgTone: "bg-emerald-50/50",
    borderTone: "border-emerald-100",
  },
];

export function DashboardWorkflow({
  initialApplicants,
  initialOnboarding,
}: {
  initialApplicants: ApplicantBoardItem[];
  initialOnboarding: DashboardOnboarding;
}) {
  const [applicants, setApplicants] = useState(initialApplicants);
  const [onboarding, setOnboarding] = useState(initialOnboarding);
  const [message, setMessage] = useState<string | null>(null);
  const [pendingTasks, setPendingTasks] = useState<Set<string>>(new Set());
  const [, startTransition] = useTransition();

  function handleDragEnd(event: DragEndEvent) {
    if (event.canceled) return;
    const applicationId = String(event.operation.source?.id || "");
    const nextColumn = event.operation.target?.data?.column as
      | ApplicantBoardColumn
      | undefined;
    const applicant = applicants.find((item) => item.id === applicationId);
    if (!applicant || !nextColumn || applicant.column === nextColumn) return;

    const previousColumn = applicant.column;
    setMessage(null);
    setApplicants((current) =>
      current.map((item) =>
        item.id === applicationId
          ? { ...item, column: nextColumn, daysInStage: 0 }
          : item,
      ),
    );
    startTransition(async () => {
      const result = await moveApplicationStage(applicationId, nextColumn);
      if (!result.ok) {
        setApplicants((current) =>
          current.map((item) =>
            item.id === applicationId
              ? { ...item, column: previousColumn }
              : item,
          ),
        );
      }
      setMessage(result.message);
    });
  }

  function handleTaskToggle(taskId: string) {
    if (!onboarding || pendingTasks.has(taskId)) return;
    const task = onboarding.tasks.find((item) => item.id === taskId);
    if (!task) return;
    const completed = !task.completed;

    setMessage(null);
    setPendingTasks((current) => new Set(current).add(taskId));
    setOnboarding((current) =>
      current
        ? {
            ...current,
            tasks: current.tasks.map((item) =>
              item.id === taskId ? { ...item, completed } : item,
            ),
          }
        : current,
    );
    startTransition(async () => {
      const result = await toggleOnboardingTask(taskId, completed);
      if (!result.ok) {
        setOnboarding((current) =>
          current
            ? {
                ...current,
                tasks: current.tasks.map((item) =>
                  item.id === taskId
                    ? { ...item, completed: task.completed }
                    : item,
                ),
              }
            : current,
        );
      }
      setPendingTasks((current) => {
        const next = new Set(current);
        next.delete(taskId);
        return next;
      });
      setMessage(result.message);
    });
  }

  return (
    <section className="grid min-w-0 items-start gap-6 xl:grid-cols-[minmax(0,2.2fr)_minmax(320px,.7fr)]">
      <div className="flex min-w-0 flex-col rounded-3xl bg-white p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] sm:p-8 xl:h-[520px]">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold tracking-tight text-slate-900">
                Applicant Pipeline
              </h2>
              <span className="rounded-full bg-brand-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-brand-600">
                Live
              </span>
            </div>
            <p className="mt-1.5 text-sm text-slate-500">
              Drag applicants between stages to update their recruitment status.
            </p>
          </div>
          <Link
            href="/hr/recruitment/applicants"
            className="group flex w-fit items-center gap-1.5 rounded-full bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
          >
            All applicants
            <ArrowUpRight className="h-4 w-4 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
          </Link>
        </div>

        <DragDropProvider onDragEnd={handleDragEnd}>
          <div className="grid gap-4 md:grid-cols-3 xl:min-h-0 xl:flex-1">
            {columns.map((column) => (
              <ApplicantColumn
                key={column.id}
                column={column}
                applicants={applicants.filter(
                  (applicant) => applicant.column === column.id,
                )}
              />
            ))}
          </div>
        </DragDropProvider>
      </div>

      <div className="flex flex-col rounded-3xl bg-white p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] sm:p-8 xl:h-[520px]">
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-slate-900">
              Onboarding Progress
            </h2>
            <p className="mt-1.5 text-sm text-slate-500">
              Active new hire checklists.
            </p>
          </div>
          <span className="grid h-10 w-10 place-items-center rounded-2xl bg-orange-50 text-orange-500">
            <BriefcaseBusiness className="h-5 w-5" />
          </span>
        </div>
        {onboarding ? (
          <OnboardingChecklist
            onboarding={onboarding}
            pendingTasks={pendingTasks}
            onToggle={handleTaskToggle}
          />
        ) : (
          <div className="grid min-h-72 flex-1 place-items-center rounded-2xl bg-slate-50 text-center">
            <div>
              <CircleCheck className="mx-auto h-8 w-8 text-emerald-500" />
              <p className="mt-4 text-base font-semibold text-slate-900">
                Onboarding is up to date
              </p>
              <p className="mt-1 text-sm text-slate-500">
                No active checklists need attention.
              </p>
            </div>
          </div>
        )}
      </div>
      <p className="sr-only" aria-live="polite">
        {message}
      </p>
    </section>
  );
}

function ApplicantColumn({
  column,
  applicants,
}: {
  column: (typeof columns)[number];
  applicants: ApplicantBoardItem[];
}) {
  const { ref, isDropTarget } = useDroppable({
    id: `column-${column.id}`,
    data: { column: column.id },
  });
  const Icon = column.icon;
  return (
    <div
      ref={ref}
      className={cn(
        "min-h-[300px] rounded-3xl border-2 p-4 transition-all duration-300",
        column.bgTone,
        column.borderTone,
        isDropTarget && "border-brand-300 bg-brand-50 shadow-[0_0_0_4px_rgba(59,130,246,0.1)]",
      )}
    >
      <div className="mb-5 flex items-center justify-between px-1">
        <div className="flex items-center gap-3">
          <span className={cn("grid h-9 w-9 place-items-center rounded-xl", column.tone)}>
            <Icon className="h-4 w-4" />
          </span>
          <div>
            <div className="text-sm font-bold text-slate-900">
              {column.title}
            </div>
            <div className="text-[11px] text-slate-500">
              {column.description}
            </div>
          </div>
        </div>
        <span className="grid h-7 min-w-[28px] place-items-center rounded-full bg-white px-2.5 text-xs font-bold text-slate-700 shadow-sm">
          {applicants.length}
        </span>
      </div>
      <div className="space-y-3.5">
        {applicants.map((applicant) => (
          <ApplicantCard key={applicant.id} applicant={applicant} />
        ))}
        {!applicants.length && (
          <div className="grid h-28 place-items-center rounded-2xl border-2 border-dashed border-slate-200 bg-white/50 text-xs font-medium text-slate-400">
            Drop here
          </div>
        )}
      </div>
    </div>
  );
}

function ApplicantCard({ applicant }: { applicant: ApplicantBoardItem }) {
  const { ref, handleRef, isDragging } = useDraggable({
    id: applicant.id,
    data: { applicantId: applicant.id },
  });
  return (
    <article
      ref={ref}
      className={cn(
        "group rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_2px_10px_rgb(0,0,0,0.02)] transition-all duration-300 ease-out hover:-translate-y-1 hover:border-slate-200 hover:shadow-[0_12px_24px_rgb(0,0,0,0.06)]",
        isDragging && "z-50 scale-105 border-brand-300 opacity-95 shadow-2xl",
      )}
    >
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand-50 text-xs font-bold text-brand-700">
          {initials(applicant.name)}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-bold text-slate-900">
            {applicant.name}
          </h3>
          <p className="mt-0.5 truncate text-xs font-medium text-slate-500">
            {applicant.role}
          </p>
        </div>
        <button
          ref={handleRef}
          type="button"
          aria-label={`Move ${applicant.name}.`}
          className="-mr-1 -mt-1 grid h-8 w-8 shrink-0 touch-none cursor-grab place-items-center rounded-xl text-slate-300 transition-colors duration-200 hover:bg-slate-50 hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 active:cursor-grabbing"
        >
          <GripVertical className="h-4 w-4" />
        </button>
      </div>
      <div className="mt-4 flex items-center justify-between border-t border-slate-50 pt-3">
        <span className="rounded-md bg-slate-50 px-2 py-1 text-[10px] font-semibold text-slate-500">
          {applicant.department}
        </span>
        <span className="flex shrink-0 items-center gap-2.5 text-xs font-medium text-slate-400">
          {applicant.rating > 0 && (
            <span className="flex items-center gap-1 text-amber-500">
              <Star className="h-3.5 w-3.5 fill-current" />
              {applicant.rating.toFixed(1)}
            </span>
          )}
          <span className="flex items-center gap-1 text-slate-400">
            <Clock3 className="h-3.5 w-3.5" />
            {applicant.daysInStage}d
          </span>
        </span>
      </div>
    </article>
  );
}

function OnboardingChecklist({
  onboarding,
  pendingTasks,
  onToggle,
}: {
  onboarding: NonNullable<DashboardOnboarding>;
  pendingTasks: Set<string>;
  onToggle: (taskId: string) => void;
}) {
  const completed = onboarding.tasks.filter((task) => task.completed).length;
  const progress = onboarding.tasks.length
    ? Math.round((completed / onboarding.tasks.length) * 100)
    : 0;
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="rounded-2xl bg-brand-50/50 p-5">
        <div className="flex items-center gap-4">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-brand-100 text-sm font-bold text-brand-700">
            {initials(onboarding.employee)}
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-base font-bold text-slate-900">
              {onboarding.employee}
            </div>
            <div className="mt-1 truncate text-xs font-medium text-slate-500">
              {onboarding.position} · Starts {formatDate(onboarding.startDate)}
            </div>
          </div>
          <span className="text-sm font-black text-brand-700">{progress}%</span>
        </div>
        <div
          className="mt-5 h-2.5 overflow-hidden rounded-full bg-white/60 shadow-inner"
          role="progressbar"
          aria-label={`${onboarding.employee} onboarding progress`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progress}
        >
          <div
            className="h-full rounded-full bg-brand-500 transition-[width] duration-700 ease-out motion-reduce:transition-none"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="mt-3 text-xs font-medium text-slate-500">
          <span className="font-bold text-brand-700">{completed}</span> of {onboarding.tasks.length} tasks complete
        </p>
      </div>

      <div className="mt-6 min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain pr-1">
        {onboarding.tasks.map((task) => (
          <button
            key={task.id}
            type="button"
            disabled={pendingTasks.has(task.id)}
            aria-pressed={task.completed}
            onClick={() => onToggle(task.id)}
            className="group flex w-full items-center gap-4 rounded-2xl border border-transparent p-3 text-left transition-all duration-300 hover:border-slate-100 hover:bg-slate-50 hover:shadow-sm active:scale-[.99] disabled:cursor-wait disabled:opacity-60"
          >
            <span
              className={cn(
                "grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 transition-all duration-300",
                task.completed
                  ? "scale-100 border-brand-500 bg-brand-500 text-white"
                  : "border-slate-200 bg-white text-transparent group-hover:border-brand-400",
              )}
            >
              <Check
                className={cn(
                  "h-3.5 w-3.5 transition-transform duration-300",
                  task.completed ? "scale-100" : "scale-0",
                )}
              />
            </span>
            <span className="min-w-0 flex-1">
              <span
                className={cn(
                  "relative inline-block max-w-full truncate text-sm font-semibold transition-colors duration-300",
                  task.completed ? "text-slate-400" : "text-slate-800",
                )}
              >
                {task.title}
                <span
                  aria-hidden="true"
                  className={cn(
                    "absolute left-0 top-1/2 h-[1.5px] w-full origin-left bg-slate-300 transition-transform duration-300 ease-out motion-reduce:transition-none",
                    task.completed ? "scale-x-100" : "scale-x-0",
                  )}
                />
              </span>
              <span className="mt-1 block text-xs font-medium text-slate-400">
                {task.category}
              </span>
            </span>
          </button>
        ))}
      </div>

      <div className="mt-6 text-center">
        <Link
          href="/hr/onboarding"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-600 transition-colors hover:text-brand-800"
        >
          View complete checklist
          <ArrowUpRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}
