import type { Metadata } from "next";
import Link from "next/link";
import {
  BriefcaseBusiness,
  CircleUserRound,
  UserRoundPlus,
  Users,
} from "lucide-react";
import { DashboardCharts } from "@/components/dashboard-charts";
import { DashboardWorkflow } from "@/components/dashboard-workflow";
import {
  getDashboardApplicantBoard,
  getDashboardAnalytics,
  getDashboardData,
  getDashboardOnboarding,
} from "@/lib/hr-data";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "HR overview" };

export default async function DashboardPage() {
  const [
    metrics,
    analytics,
    applicantBoard,
    onboardingWidget,
  ] = await Promise.all([
    getDashboardData(),
    getDashboardAnalytics(),
    getDashboardApplicantBoard(),
    getDashboardOnboarding(),
  ]);

  const cards = [
    {
      label: "Active employees",
      value: metrics.employees,
      change: "+18 this quarter",
      icon: Users,
      tone: "text-emerald-600 bg-emerald-100",
    },
    {
      label: "Active applicants",
      value: metrics.applicants,
      change: "24 new this week",
      icon: CircleUserRound,
      tone: "text-blue-600 bg-blue-100",
    },
    {
      label: "Open positions",
      value: metrics.vacancies,
      change: "5 closing soon",
      icon: BriefcaseBusiness,
      tone: "text-violet-600 bg-violet-100",
    },
    {
      label: "Onboarding",
      value: metrics.onboarding,
      change: "3 start next week",
      icon: UserRoundPlus,
      tone: "text-amber-600 bg-amber-100",
    },
  ];

  const dateLabel = new Intl.DateTimeFormat("en", {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(new Date());

  return (
    <div className="space-y-8">
      <header className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
        <div className="space-y-2">
          <p className="text-sm font-bold uppercase tracking-widest text-brand-500">
            {dateLabel}
          </p>
          <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 md:text-5xl">
            Good morning, Alex
          </h1>
          <p className="text-lg font-medium text-slate-500">
            Here's what's happening across your people operations today.
          </p>
        </div>
        <Link
          href="/hr/recruitment/applicants"
          className="group flex h-12 items-center gap-2.5 rounded-2xl bg-brand-600 px-6 text-sm font-bold text-white shadow-[0_8px_20px_rgb(37,99,235,0.24)] transition-all duration-300 hover:-translate-y-1 hover:bg-brand-500 hover:shadow-[0_12px_24px_rgb(37,99,235,0.32)] active:translate-y-0"
        >
          <UserRoundPlus className="h-5 w-5 transition-transform duration-300 group-hover:scale-110" />
          Add applicant
        </Link>
      </header>

      {/* Metrics Section */}
      <section className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <div
            key={card.label}
            className="group rounded-3xl bg-white p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_12px_40px_rgb(0,0,0,0.08)]"
          >
            <div className="flex items-center justify-between">
              <span
                className={cn(
                  "grid h-12 w-12 place-items-center rounded-2xl transition-transform duration-300 group-hover:scale-110",
                  card.tone,
                )}
              >
                <card.icon className="h-5 w-5" />
              </span>
              <span className="rounded-full bg-slate-50 px-3 py-1 text-xs font-bold text-slate-500">
                Live
              </span>
            </div>
            <div className="mt-6 text-4xl font-black tracking-tight text-slate-900">
              {card.value.toLocaleString()}
            </div>
            <div className="mt-1 text-sm font-bold text-slate-500">{card.label}</div>
            <div className="mt-4 border-t border-slate-100 pt-4 text-xs font-bold text-brand-600">
              {card.change}
            </div>
          </div>
        ))}
      </section>

      <DashboardWorkflow
        initialApplicants={applicantBoard}
        initialOnboarding={onboardingWidget}
      />

      <DashboardCharts analytics={analytics} />
    </div>
  );
}
