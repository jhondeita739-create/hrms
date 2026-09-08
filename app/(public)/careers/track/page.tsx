import type { Metadata } from "next";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { ApplicationTracker } from "@/components/application-tracker";

export const metadata: Metadata = {
  title: "Track your application · HRMS",
  description: "Check the current stage of your HRMS job application.",
};

export default function TrackApplicationPage() {
  return (
    <main className="relative min-h-[calc(100vh-80px)] overflow-hidden bg-[#FAFBFF] selection:bg-brand-200">
      <div className="pointer-events-none absolute left-[10%] top-[10%] h-[600px] w-[600px] rounded-full bg-emerald-300/20 mix-blend-multiply blur-[100px]" />
      <div className="pointer-events-none absolute bottom-[10%] right-[10%] h-[600px] w-[600px] rounded-full bg-blue-300/20 mix-blend-multiply blur-[100px]" />

      <div className="relative z-10 mx-auto w-full max-w-5xl px-4 py-12 sm:px-6 lg:px-8 lg:py-20">
        <Link href="/careers" className="group mb-8 flex w-max items-center gap-2 rounded-full bg-white/70 px-5 py-2.5 text-sm font-bold text-slate-500 shadow-sm backdrop-blur-md transition-all hover:bg-white hover:text-slate-900 lg:mb-12">
          <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
          Back to open roles
        </Link>

        <div className="grid gap-12 lg:grid-cols-[1fr_1.2fr] lg:items-center">
          <div>
            <span className="grid h-16 w-16 place-items-center rounded-2xl bg-brand-50 text-brand-600 shadow-sm">
              <ShieldCheck className="h-8 w-8" />
            </span>
            <h1 className="mt-8 text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">Track your application.</h1>
            <p className="mt-6 text-lg leading-relaxed text-slate-500">
              Your resume already contains your education and experience. This page shows resume verification, your current stage, interview schedule, and HR updates.
            </p>
          </div>
          <div className="rounded-[2.5rem] border border-white/60 bg-white/60 p-6 shadow-2xl shadow-indigo-900/10 backdrop-blur-2xl sm:p-10">
            <ApplicationTracker />
          </div>
        </div>
      </div>
    </main>
  );
}
