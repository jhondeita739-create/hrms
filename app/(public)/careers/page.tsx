import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BriefcaseBusiness, Search } from "lucide-react";
import { getPublicVacancies } from "@/lib/careers-data";
import { EmptyJobs, JobMeta } from "@/components/public-site-shell";

export const metadata: Metadata = {
  title: "Open roles · HRMS",
  description: "Explore open opportunities and submit your application through HRMS.",
};

export default async function CareersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; department?: string }>;
}) {
  const params = await searchParams;
  const vacancies = await getPublicVacancies();
  const departments = Array.from(
    new Set(vacancies.map((item) => item.department)),
  ).sort();
  const query = (params.q || "").trim().toLowerCase();
  const filtered = vacancies.filter(
    (item) =>
      (!query ||
        [
          item.title,
          item.department,
          item.location,
          item.description,
          ...item.requiredSkills,
        ]
          .join(" ")
          .toLowerCase()
          .includes(query)) &&
      (!params.department || item.department === params.department),
  );
  return (
    <main className="relative min-h-[calc(100vh-80px)] bg-[#FAFBFF] overflow-hidden selection:bg-brand-200">
      {/* Background Mesh Gradients */}
      <div className="pointer-events-none absolute left-[10%] top-[-10%] h-[500px] w-[500px] rounded-full bg-blue-300/20 mix-blend-multiply blur-[100px]" />
      <div className="pointer-events-none absolute right-[10%] top-[20%] h-[500px] w-[500px] rounded-full bg-indigo-300/20 mix-blend-multiply blur-[100px]" />

      <section className="relative z-10 mx-auto max-w-[1400px] px-6 pt-16 lg:px-12 xl:pt-24">
        <div className="mx-auto max-w-2xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-brand-700 shadow-sm">
            HRMS Careers
          </div>
          <h1 className="mt-6 text-5xl font-extrabold tracking-tight text-slate-900 md:text-6xl">
            Find your next role.
          </h1>
          <p className="mt-6 text-lg leading-relaxed text-slate-500">
            Join a team where your experience, curiosity, and perspective can
            make a meaningful difference.
          </p>
        </div>
      </section>

      <section className="relative z-10 mx-auto mt-16 grid w-full max-w-[1400px] gap-10 px-6 pb-24 lg:grid-cols-[280px_minmax(0,1fr)] lg:px-12 xl:gap-16">
        <aside>
          <div className="sticky top-32 rounded-3xl border border-white/40 bg-white/60 p-6 shadow-xl shadow-indigo-900/5 backdrop-blur-3xl">
            <form className="space-y-6">
              <div>
                <label
                  className="mb-3 block text-sm font-bold text-slate-900"
                  htmlFor="q"
                >
                  Search roles
                </label>
                <div className="relative">
                  <Search className="absolute left-4 top-3.5 h-5 w-5 text-slate-400" />
                  <input
                    id="q"
                    name="q"
                    defaultValue={params.q}
                    placeholder="Title, skill, location…"
                    className="h-12 w-full rounded-2xl border border-slate-200 bg-white pl-11 pr-4 text-sm font-medium text-slate-900 outline-none transition-all focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10"
                  />
                </div>
              </div>
              <div>
                <label
                  className="mb-3 block text-sm font-bold text-slate-900"
                  htmlFor="department"
                >
                  Department
                </label>
                <select
                  id="department"
                  name="department"
                  defaultValue={params.department || ""}
                  className="h-12 w-full appearance-none rounded-2xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-900 outline-none transition-all focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10"
                >
                  <option value="">All departments</option>
                  {departments.map((department) => (
                    <option key={department}>{department}</option>
                  ))}
                </select>
              </div>
              <button className="h-12 w-full rounded-full bg-slate-900 text-sm font-bold text-white shadow-md transition-all hover:bg-slate-800 hover:shadow-xl active:scale-95">
                Apply filters
              </button>
              {(params.q || params.department) && (
                <Link
                  href="/careers"
                  className="block text-center text-sm font-bold text-slate-500 transition-colors hover:text-brand-700"
                >
                  Clear filters
                </Link>
              )}
            </form>
          </div>
        </aside>
        
        <div>
          <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div className="text-xl font-extrabold text-slate-900">
              {filtered.length}{" "}
              {filtered.length === 1 ? "opportunity" : "opportunities"}
            </div>
            <Link
              href="/careers/track"
              className="text-sm font-bold text-brand-600 transition-colors hover:text-brand-700"
            >
              Already applied? Track status
            </Link>
          </div>
          {filtered.length ? (
            <div className="grid gap-5 xl:grid-cols-2">
              {filtered.map((job) => (
                <Link
                  href={`/careers/${job.id}`}
                  key={job.id}
                  className="group flex flex-col justify-between gap-6 rounded-3xl border border-white/60 bg-white/70 p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:border-brand-200 hover:bg-white hover:shadow-[0_12px_40px_rgb(37,99,235,0.08)]"
                >
                  <div className="flex items-start gap-5">
                    <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-brand-50 text-brand-600 transition-transform duration-300 group-hover:scale-110">
                      <BriefcaseBusiness className="h-6 w-6" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold uppercase tracking-wider text-brand-600">
                        {job.department}
                      </div>
                      <h2 className="mt-2 text-xl font-bold tracking-tight text-slate-900 group-hover:text-brand-700">
                        {job.title}
                      </h2>
                      <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-slate-500">
                        {job.description}
                      </p>
                    </div>
                  </div>
                  
                  <div className="mt-4 flex flex-col justify-between gap-4 border-t border-slate-100 pt-5 sm:flex-row sm:items-center">
                    <JobMeta
                      employmentType={job.employmentType}
                      workArrangement={job.workArrangement}
                      location={job.location}
                    />
                    <span className="flex items-center gap-1.5 rounded-full bg-slate-900 px-4 py-2 text-xs font-bold text-white shadow-md transition-all group-hover:bg-brand-600 group-hover:shadow-lg">
                      View role <ArrowRight className="h-3.5 w-3.5" />
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <EmptyJobs />
          )}
        </div>
      </section>
    </main>
  );
}
