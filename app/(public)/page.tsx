import Link from "next/link";
import {
  ArrowRight,
  BriefcaseBusiness,
  CheckCircle2,
  UsersRound,
  Sparkles,
  Check,
  Star,
  Clock3,
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function MarketingHomePage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#FAFBFF] font-sans selection:bg-brand-200">
      {/* Background Mesh Gradients */}
      <div className="pointer-events-none absolute left-[-10%] top-[-10%] h-[600px] w-[600px] rounded-full bg-blue-400/20 mix-blend-multiply blur-[120px]" />
      <div className="pointer-events-none absolute right-[-10%] top-[10%] h-[600px] w-[600px] rounded-full bg-violet-400/20 mix-blend-multiply blur-[120px]" />

      {/* Hero Section */}
      <section className="relative z-10 mx-auto max-w-7xl px-6 pt-20 text-center md:pt-32 lg:px-8">
        <div className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-4 py-2 text-xs font-bold text-brand-700 shadow-sm">
          <Sparkles className="h-4 w-4" />
          The Modern HR Platform
        </div>
        <h1 className="mx-auto mt-8 max-w-4xl text-5xl font-extrabold tracking-tight text-slate-900 sm:text-6xl md:text-7xl">
          Build a team that <span className="text-brand-600">thrives</span>.
        </h1>
        <p className="mx-auto mt-8 max-w-2xl text-lg leading-relaxed text-slate-500 sm:text-xl">
          Everything you need to attract top talent, manage applicant pipelines, and deliver an unforgettable onboarding experience.
        </p>
        <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Link
            href="/login"
            className="group flex h-14 items-center gap-2 rounded-full bg-brand-600 px-8 text-base font-bold text-white shadow-[0_8px_30px_rgb(37,99,235,0.3)] transition-all hover:-translate-y-1 hover:bg-brand-500 hover:shadow-[0_12px_40px_rgb(37,99,235,0.4)] active:translate-y-0"
          >
            Try it for free
            <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
          </Link>
          <Link
            href="#mockup"
            className="flex h-14 items-center justify-center rounded-full bg-white px-8 text-base font-bold text-slate-700 shadow-sm ring-1 ring-slate-200 transition-all hover:bg-slate-50 hover:shadow-md"
          >
            See how it works
          </Link>
        </div>
      </section>

      {/* Interactive Mockup Section */}
      <section id="mockup" className="relative z-10 mx-auto mt-24 max-w-[1400px] px-6 lg:px-12">
        <div className="relative rounded-[2.5rem] border border-white/40 bg-white/40 p-4 shadow-2xl shadow-indigo-900/10 backdrop-blur-3xl sm:p-8">
          
          {/* Mockup Dashboard Shell */}
          <div className="overflow-hidden rounded-[2rem] border border-white/80 bg-slate-50 shadow-inner">
            
            <div className="grid gap-6 p-6 lg:grid-cols-[1.5fr_1fr] lg:p-10">
              
              {/* Mock Kanban Board */}
              <div className="rounded-3xl bg-white p-6 shadow-sm">
                <div className="mb-6 flex items-center justify-between">
                  <h3 className="text-xl font-bold text-slate-900">Applicant Pipeline</h3>
                  <div className="flex gap-2">
                    <div className="h-2 w-2 rounded-full bg-red-400" />
                    <div className="h-2 w-2 rounded-full bg-amber-400" />
                    <div className="h-2 w-2 rounded-full bg-emerald-400" />
                  </div>
                </div>
                
                <div className="grid gap-4 md:grid-cols-2">
                  {/* Column 1 */}
                  <div className="min-h-[300px] rounded-2xl bg-blue-50/50 p-3">
                    <div className="mb-4 flex items-center gap-2 px-1">
                      <div className="grid h-8 w-8 place-items-center rounded-xl bg-blue-100 text-blue-600">
                        <UsersRound className="h-4 w-4" />
                      </div>
                      <span className="text-sm font-bold text-slate-800">Interviewing</span>
                    </div>
                    
                    <div className="space-y-3">
                      <div className="group rounded-xl border border-white bg-white p-4 shadow-[0_2px_10px_rgb(0,0,0,0.04)] transition-all hover:-translate-y-1 hover:shadow-xl">
                        <div className="flex items-center gap-3">
                          <div className="grid h-10 w-10 place-items-center rounded-full bg-brand-50 text-xs font-bold text-brand-700">SJ</div>
                          <div>
                            <div className="text-sm font-bold text-slate-900">Sarah Jenkins</div>
                            <div className="text-xs text-slate-500">Senior Designer</div>
                          </div>
                        </div>
                        <div className="mt-4 flex items-center justify-between">
                          <span className="rounded-md bg-slate-50 px-2 py-1 text-[10px] font-semibold text-slate-500">Product</span>
                          <div className="flex items-center gap-1 text-xs font-medium text-amber-500">
                            <Star className="h-3 w-3 fill-current" /> 4.8
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Column 2 */}
                  <div className="min-h-[300px] rounded-2xl bg-emerald-50/50 p-3">
                    <div className="mb-4 flex items-center gap-2 px-1">
                      <div className="grid h-8 w-8 place-items-center rounded-xl bg-emerald-100 text-emerald-600">
                        <CheckCircle2 className="h-4 w-4" />
                      </div>
                      <span className="text-sm font-bold text-slate-800">Hired</span>
                    </div>
                    
                    <div className="space-y-3">
                      <div className="group rounded-xl border border-white bg-white p-4 shadow-[0_2px_10px_rgb(0,0,0,0.04)] transition-all hover:-translate-y-1 hover:shadow-xl">
                        <div className="flex items-center gap-3">
                          <div className="grid h-10 w-10 place-items-center rounded-full bg-brand-50 text-xs font-bold text-brand-700">MR</div>
                          <div>
                            <div className="text-sm font-bold text-slate-900">Michael Ross</div>
                            <div className="text-xs text-slate-500">Frontend Engineer</div>
                          </div>
                        </div>
                        <div className="mt-4 flex items-center justify-between">
                          <span className="rounded-md bg-slate-50 px-2 py-1 text-[10px] font-semibold text-slate-500">Engineering</span>
                          <div className="flex items-center gap-1 text-xs font-medium text-slate-400">
                            <Clock3 className="h-3 w-3" /> 2d
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Mock Onboarding Widget */}
              <div className="rounded-3xl bg-white p-6 shadow-sm">
                <h3 className="mb-6 text-xl font-bold text-slate-900">Onboarding</h3>
                <div className="rounded-2xl bg-brand-50/50 p-5">
                  <div className="flex items-center gap-4">
                    <div className="grid h-12 w-12 place-items-center rounded-full bg-brand-100 text-sm font-bold text-brand-700">AL</div>
                    <div className="flex-1">
                      <div className="text-base font-bold text-slate-900">Alex Lee</div>
                      <div className="text-xs font-medium text-slate-500">Starts Oct 12</div>
                    </div>
                    <span className="text-sm font-black text-brand-700">75%</span>
                  </div>
                  <div className="mt-5 h-2.5 overflow-hidden rounded-full bg-white/60 shadow-inner">
                    <div className="h-full w-3/4 rounded-full bg-brand-500" />
                  </div>
                </div>
                
                <div className="mt-6 space-y-3">
                  {[
                    { title: "Sign employment contract", done: true },
                    { title: "Set up company email", done: true },
                    { title: "Schedule welcome lunch", done: false },
                  ].map((task, i) => (
                    <div key={i} className="flex items-center gap-4 rounded-2xl border border-slate-100 p-3 hover:bg-slate-50">
                      <div className={cn("grid h-6 w-6 place-items-center rounded-full border-2", task.done ? "border-brand-500 bg-brand-500 text-white" : "border-slate-200")}>
                        <Check className={cn("h-3.5 w-3.5", task.done ? "opacity-100" : "opacity-0")} />
                      </div>
                      <span className={cn("text-sm font-semibold", task.done ? "text-slate-400 line-through" : "text-slate-800")}>{task.title}</span>
                    </div>
                  ))}
                </div>
              </div>
              
            </div>
          </div>
        </div>
      </section>

      <section
        id="hiring-process"
        className="relative z-10 mx-auto mt-32 max-w-7xl scroll-mt-28 px-6 lg:px-8"
      >
        <div className="grid gap-10 rounded-[2.5rem] bg-slate-950 px-6 py-12 text-white shadow-2xl sm:px-10 lg:grid-cols-[.72fr_1.28fr] lg:items-center lg:px-14 lg:py-16">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.18em] text-blue-300">
              How we hire
            </p>
            <h2 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl">
              Clear steps. Human decisions.
            </h2>
            <p className="mt-4 max-w-md text-sm leading-7 text-slate-400 sm:text-base">
              Every candidate gets a transparent process, thoughtful review, and timely updates from application to offer.
            </p>
          </div>
          <ol className="grid gap-3 sm:grid-cols-2">
            {[
              ["01", "Apply", "Share your experience and preferred role."],
              ["02", "Human review", "Our hiring team reviews every application."],
              ["03", "Meet the team", "Discuss the work, expectations, and your goals."],
              ["04", "Decision", "Receive a clear outcome and next-step guidance."],
            ].map(([number, title, text]) => (
              <li
                key={number}
                className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm transition-colors hover:bg-white/10"
              >
                <div className="text-xs font-black text-blue-300">{number}</div>
                <h3 className="mt-3 text-base font-bold">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-400">{text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Features Section */}
      <section className="relative z-10 mx-auto mt-32 max-w-7xl px-6 pb-32 lg:px-8">
        <div className="text-center">
          <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
            Designed for modern HR teams.
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-500">
            Ditch the spreadsheets. Our tools are beautifully crafted to make managing people a breeze.
          </p>
        </div>
        <div className="mt-16 grid gap-8 md:grid-cols-3">
          <div className="rounded-3xl bg-white p-8 shadow-[0_4px_20px_rgb(0,0,0,0.03)] transition-transform hover:-translate-y-2">
            <div className="grid h-14 w-14 place-items-center rounded-2xl bg-blue-50 text-blue-600">
              <UsersRound className="h-6 w-6" />
            </div>
            <h3 className="mt-6 text-xl font-bold text-slate-900">Recruitment Pipeline</h3>
            <p className="mt-3 text-slate-500">Track candidates effortlessly with a drag-and-drop Kanban board designed for speed and clarity.</p>
          </div>
          <div className="rounded-3xl bg-white p-8 shadow-[0_4px_20px_rgb(0,0,0,0.03)] transition-transform hover:-translate-y-2">
            <div className="grid h-14 w-14 place-items-center rounded-2xl bg-brand-50 text-brand-600">
              <BriefcaseBusiness className="h-6 w-6" />
            </div>
            <h3 className="mt-6 text-xl font-bold text-slate-900">Seamless Onboarding</h3>
            <p className="mt-3 text-slate-500">Ensure new hires feel welcome with automated checklists and progress tracking before day one.</p>
          </div>
          <div className="rounded-3xl bg-white p-8 shadow-[0_4px_20px_rgb(0,0,0,0.03)] transition-transform hover:-translate-y-2">
            <div className="grid h-14 w-14 place-items-center rounded-2xl bg-emerald-50 text-emerald-600">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <h3 className="mt-6 text-xl font-bold text-slate-900">Applicant Management</h3>
            <p className="mt-3 text-slate-500">Keep all documents, notes, and interview ratings in one beautiful, organized applicant profile.</p>
          </div>
        </div>
      </section>

    </main>
  );
}
