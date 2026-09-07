import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
  MapPin,
  UsersRound,
} from "lucide-react";
import { getPublicVacancy } from "@/lib/careers-data";
import { PublicApplicationForm } from "@/components/public-application-form";
import { formatDate, formatMoney } from "@/lib/utils";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ vacancyId: string }>;
}): Promise<Metadata> {
  const job = await getPublicVacancy((await params).vacancyId);
  return {
    title: job ? `${job.title} · HRMS Careers` : "Role not found",
    description: job?.description,
  };
}

export default async function VacancyPage({
  params,
}: {
  params: Promise<{ vacancyId: string }>;
}) {
  const job = await getPublicVacancy((await params).vacancyId);
  if (!job) notFound();
  
  return (
    <main className="relative min-h-[calc(100vh-80px)] bg-[#FAFBFF] selection:bg-brand-200">
      {/* Background Mesh Gradients */}
      <div className="pointer-events-none absolute left-[5%] top-0 h-[600px] w-[600px] rounded-full bg-blue-300/10 mix-blend-multiply blur-[120px]" />
      <div className="pointer-events-none absolute right-[5%] top-[20%] h-[600px] w-[600px] rounded-full bg-violet-300/10 mix-blend-multiply blur-[120px]" />

      <section className="relative z-10 border-b border-white/40 bg-white/40 backdrop-blur-3xl">
        <div className="mx-auto w-full max-w-[1400px] px-6 py-12 sm:px-12 lg:py-16">
          <Link
            href="/careers"
            className="group mb-8 inline-flex items-center gap-2 rounded-full bg-white/60 px-4 py-2 text-sm font-bold text-slate-500 shadow-sm backdrop-blur-md transition-all hover:bg-white hover:text-slate-900"
          >
            <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
            All open roles
          </Link>
          
          <div className="flex flex-col justify-between gap-8 md:flex-row md:items-end">
            <div>
              <div className="inline-flex items-center rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-xs font-bold uppercase tracking-widest text-brand-700 shadow-sm">
                {job.department}
              </div>
              <h1 className="mt-4 text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl lg:text-6xl">
                {job.title}
              </h1>
              <div className="mt-6 flex flex-wrap gap-4 text-sm font-bold text-slate-500">
                <span className="flex items-center gap-2 rounded-full bg-white px-4 py-2 shadow-sm">
                  <MapPin className="h-4 w-4 text-slate-400" />
                  {job.location} · {job.workArrangement}
                </span>
                <span className="flex items-center gap-2 rounded-full bg-white px-4 py-2 shadow-sm">
                  <BriefcaseBusiness className="h-4 w-4 text-slate-400" />
                  {job.employmentType}
                </span>
                <span className="flex items-center gap-2 rounded-full bg-white px-4 py-2 shadow-sm">
                  <UsersRound className="h-4 w-4 text-slate-400" />
                  {job.openings} {job.openings === 1 ? "opening" : "openings"}
                </span>
                {job.closingDate && (
                  <span className="flex items-center gap-2 rounded-full bg-white px-4 py-2 shadow-sm">
                    <CalendarDays className="h-4 w-4 text-slate-400" />
                    Apply by {formatDate(job.closingDate)}
                  </span>
                )}
              </div>
            </div>
            <a
              href="#apply"
              className="group flex h-14 w-fit items-center rounded-full bg-slate-900 px-8 text-base font-bold text-white shadow-[0_4px_14px_rgb(0,0,0,0.2)] transition-all duration-300 hover:-translate-y-1 hover:bg-slate-800 hover:shadow-[0_8px_30px_rgb(0,0,0,0.25)] active:translate-y-0"
            >
              Apply for this role
            </a>
          </div>
        </div>
      </section>
      
      <div className="relative z-10 mx-auto grid w-full max-w-[1400px] items-start gap-8 px-6 py-12 sm:px-12 lg:py-16 xl:grid-cols-[minmax(320px,.72fr)_minmax(620px,1.28fr)] xl:gap-10">
        <article className="min-w-0 rounded-[2.5rem] border border-white/60 bg-white/70 p-7 shadow-[0_8px_30px_rgb(0,0,0,0.04)] backdrop-blur-xl sm:p-10">
          <section>
            <h2 className="text-2xl font-bold text-slate-900">About the role</h2>
            <p className="mt-4 whitespace-pre-line text-base leading-relaxed text-slate-600">
              {job.description}
            </p>
          </section>
          
          <ContentSection title="What you’ll do" text={job.responsibilities} />
          <ContentSection title="What we’re looking for" text={job.qualifications} />
          
          {job.requiredSkills.length > 0 && (
            <section className="mt-10 border-t border-slate-100 pt-10">
              <h2 className="text-2xl font-bold text-slate-900">Relevant skills</h2>
              <div className="mt-6 flex flex-wrap gap-3">
                {job.requiredSkills.map((skill) => (
                  <span
                    key={skill}
                    className="rounded-full bg-brand-50 px-4 py-2 text-sm font-bold text-brand-700 shadow-sm"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </section>
          )}
          
          {job.salaryMin != null && job.salaryMax != null && (
            <section className="mt-10 border-t border-slate-100 pt-10">
              <h2 className="text-2xl font-bold text-slate-900">Compensation range</h2>
              <p className="mt-4 text-lg font-bold text-slate-700">
                {formatMoney(job.salaryMin, job.currency)} –{" "}
                {formatMoney(job.salaryMax, job.currency)} per month
              </p>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">
                The final offer considers experience, skills, and internal equity.
              </p>
            </section>
          )}
          
          <section className="mt-12 rounded-[2rem] border border-white bg-blue-50/50 p-8 shadow-sm">
            <div className="flex gap-4">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-blue-100 text-blue-600">
                <CheckCircle2 className="h-6 w-6" />
              </span>
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  A human reviews every application
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-slate-500">
                  We use structured information to support fair review. Hiring decisions are made by our recruitment and hiring teams—not by an opaque automated score.
                </p>
              </div>
            </div>
          </section>
        </article>
        
        <aside
          id="apply"
          aria-labelledby="application-form-title"
          className="min-w-0 scroll-mt-28 rounded-[2.5rem] border border-white/70 bg-white/70 p-5 shadow-[0_12px_50px_rgb(15,23,42,0.07)] backdrop-blur-xl sm:p-8"
        >
          <div className="mb-8 border-b border-slate-200/80 px-1 pb-8 sm:px-2">
            <div className="inline-flex items-center rounded-full bg-brand-50 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-brand-700">
              Apply now
            </div>
            <h2
              id="application-form-title"
              className="mt-4 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl"
            >
              {job.title}
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-500">
              Share your contact details and a searchable PDF resume. Additional
              profile information is requested only after resume screening.
            </p>
          </div>
          
          <div className="[&_label]:font-bold [&_label]:text-slate-800 [&_input]:h-12 [&_input]:rounded-xl [&_textarea]:rounded-xl [&_button[type='submit']]:h-14 [&_button[type='submit']]:bg-brand-600 [&_button[type='submit']]:font-bold [&_button[type='submit']]:shadow-[0_8px_30px_rgb(37,99,235,0.24)] [&_button[type='submit']:hover]:bg-brand-500">
            <PublicApplicationForm vacancyId={job.id} position={job.title} />
          </div>
        </aside>
      </div>
    </main>
  );
}

function ContentSection({ title, text }: { title: string; text: string }) {
  return (
    <section className="mt-10 border-t border-slate-100 pt-10">
      <h2 className="text-2xl font-bold text-slate-900">{title}</h2>
      <p className="mt-4 whitespace-pre-line text-base leading-relaxed text-slate-600">
        {text ||
          "Details will be discussed with qualified candidates during the recruitment process."}
      </p>
    </section>
  );
}
