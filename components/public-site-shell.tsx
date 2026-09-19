"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  ArrowRight,
  BriefcaseBusiness,
  Menu,
  RefreshCw,
  ShieldCheck,
  WifiOff,
  X,
} from "lucide-react";
import payrollLogo from "../Payroll-logo-removebg.png";

export function PublicHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const navItems = [
    { href: "/careers", label: "Open roles" },
    { href: "/#hiring-process", label: "How we hire" },
    { href: "/careers/track", label: "Track application" },
  ];
  return (
    <header className="sticky top-0 z-50 border-b border-white/20 bg-white/60 shadow-[0_4px_30px_rgb(0,0,0,0.03)] backdrop-blur-2xl">
      <div className="relative mx-auto flex h-16 w-full max-w-[1600px] items-center px-4 sm:h-20 sm:px-6 lg:px-12 xl:px-24">
        <Link
          href="/"
          onClick={() => setOpen(false)}
          className="flex shrink-0 items-center rounded-xl transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-4"
        >
          <Image
            src={payrollLogo}
            alt="Priority Handling Logistics, Inc."
            priority
            className="h-auto w-32 drop-shadow-[0_2px_4px_rgba(30,64,175,0.12)] sm:w-40"
          />
          <span className="sr-only">HRMS homepage</span>
        </Link>
        <nav className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-2 lg:flex">
          {navItems.map((item) => {
            const active =
              item.href !== "/#hiring-process" &&
              pathname.startsWith(item.href);
            return (
              <Link
                aria-current={active ? "page" : undefined}
                key={item.href}
                href={item.href}
                className={`rounded-full px-5 py-2.5 text-sm font-bold transition-all duration-300 ${active ? "bg-brand-50 text-brand-700 shadow-sm" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"}`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto hidden items-center gap-4 lg:flex">
          <Link
            href="/login"
            className="text-sm font-bold text-slate-600 transition-colors hover:text-slate-900"
          >
            HR sign in
          </Link>
          <Link
            href="/careers"
            className="group flex h-11 items-center gap-2 rounded-full bg-slate-900 px-6 text-sm font-bold text-white shadow-[0_4px_14px_rgb(0,0,0,0.2)] transition-all duration-300 hover:-translate-y-0.5 hover:bg-slate-800 hover:shadow-[0_6px_20px_rgb(0,0,0,0.25)] active:translate-y-0"
          >
            View jobs <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
        <div className="ml-auto flex items-center gap-3 lg:hidden">
          <Link
            href="/careers"
            onClick={() => setOpen(false)}
            className="hidden h-10 items-center rounded-full bg-slate-900 px-5 text-sm font-bold text-white hover:bg-slate-800 sm:flex"
          >
            View jobs
          </Link>
          <button
            type="button"
            aria-label={open ? "Close navigation" : "Open navigation"}
            aria-expanded={open}
            onClick={() => setOpen(!open)}
            className="grid h-11 w-11 place-items-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm transition-colors hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>
      {open && (
        <div className="max-h-[calc(100dvh-4rem)] overflow-y-auto border-t border-slate-100 bg-white/95 px-4 py-4 shadow-2xl backdrop-blur-3xl sm:max-h-[calc(100dvh-5rem)] sm:px-6 sm:py-6 lg:hidden">
          <nav className="mx-auto max-w-[1600px] space-y-2">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="flex h-14 items-center justify-between rounded-2xl px-5 text-base font-bold text-slate-700 transition-colors hover:bg-brand-50 hover:text-brand-700"
              >
                {item.label}
                <ArrowRight className="h-4 w-4 text-slate-300" />
              </Link>
            ))}
            <div className="my-4 border-t border-slate-100" />
            <Link
              href="/login"
              onClick={() => setOpen(false)}
              className="flex h-14 items-center rounded-2xl px-5 text-base font-bold text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900"
            >
              HR team sign in
            </Link>
            <Link
              href="/careers"
              onClick={() => setOpen(false)}
              className="mt-4 flex h-14 items-center justify-center rounded-full bg-slate-900 text-base font-bold text-white shadow-lg sm:hidden"
            >
              Explore open roles
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}

export function PublicFooter() {
  return (
    <footer className="relative overflow-hidden bg-slate-950 text-white">
      {/* Decorative footer glow */}
      <div className="pointer-events-none absolute left-1/2 top-0 h-[300px] w-[min(800px,100vw)] -translate-x-1/2 rounded-full bg-brand-500/10 blur-[100px]" />
      
      <div className="relative z-10 mx-auto grid w-full max-w-[1600px] gap-10 px-4 py-12 sm:grid-cols-2 sm:px-8 sm:py-16 lg:grid-cols-[1.5fr_.7fr_.7fr_.8fr] lg:px-12 lg:py-20 xl:px-24">
        <div className="sm:col-span-2 lg:col-span-1">
          <Link
            href="/"
            className="inline-flex rounded-2xl bg-white px-4 py-3 shadow-[0_12px_30px_rgb(0,0,0,0.2)] transition-transform duration-300 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-4 focus-visible:ring-offset-slate-950"
          >
            <Image
              src={payrollLogo}
              alt="Priority Handling Logistics, Inc."
              className="h-14 w-auto sm:h-16"
            />
            <span className="sr-only">HRMS homepage</span>
          </Link>
          <p className="mt-6 max-w-sm text-sm leading-relaxed text-slate-400">
            We hire people for their potential, experience, and perspective.
            Every application is carefully reviewed by our human team.
          </p>
        </div>
        <FooterColumn
          title="Candidates"
          links={[
            { href: "/careers", label: "Open roles" },
            { href: "/careers/track", label: "Track application" },
            { href: "/#hiring-process", label: "How we hire" },
          ]}
        />
        <FooterColumn
          title="HRMS"
          links={[
            { href: "/", label: "About our team" },
            { href: "/careers", label: "Life at our organization" },
            { href: "/login", label: "HR sign in" },
          ]}
        />
        <div>
          <div className="text-xs font-bold uppercase tracking-widest text-slate-500">
            Applicant privacy
          </div>
          <div className="mt-6 flex gap-4 rounded-2xl border border-white/5 bg-white/5 p-5 backdrop-blur-sm">
            <ShieldCheck className="h-6 w-6 shrink-0 text-brand-400" />
            <p className="text-sm leading-relaxed text-slate-300">
              Your information and documents are stored privately and used securely only
              for recruitment purposes.
            </p>
          </div>
        </div>
      </div>
      <div className="relative z-10 border-t border-white/10 bg-slate-950">
        <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-4 px-4 py-7 text-sm font-medium text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-12 xl:px-24">
          <span>
            © {new Date().getFullYear()} HRMS. All rights reserved.
          </span>
          <span className="flex flex-wrap items-center gap-3">
            <span>Equal opportunity</span>
            <span className="h-1 w-1 rounded-full bg-slate-700" />
            <span>Respectful hiring</span>
          </span>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({
  title,
  links,
}: {
  title: string;
  links: Array<{ href: string; label: string }>;
}) {
  return (
    <div>
      <div className="text-xs font-bold uppercase tracking-widest text-slate-500">
        {title}
      </div>
      <div className="mt-6 space-y-4">
        {links.map((link) => (
          <Link
            key={link.label}
            href={link.href}
            className="block text-sm font-medium text-slate-300 transition-colors hover:text-white"
          >
            {link.label}
          </Link>
        ))}
      </div>
    </div>
  );
}

export function JobMeta({
  employmentType,
  workArrangement,
  location,
}: {
  employmentType: string;
  workArrangement: string;
  location: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs font-semibold text-slate-500">
      <span className="rounded-full bg-slate-100 px-3 py-1">{employmentType}</span>
      <span className="rounded-full bg-slate-100 px-3 py-1">{workArrangement}</span>
      <span className="rounded-full bg-slate-100 px-3 py-1">{location}</span>
    </div>
  );
}

export function EmptyJobs() {
  return (
    <div className="rounded-3xl border-2 border-dashed border-slate-200 bg-white/50 px-5 py-14 text-center backdrop-blur-sm sm:px-8 sm:py-20">
      <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-brand-50 text-brand-600 shadow-sm">
        <BriefcaseBusiness className="h-6 w-6" />
      </span>
      <h3 className="mt-6 text-lg font-bold text-slate-900">
        No matching roles right now
      </h3>
      <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-slate-500">
        Try a broader search or check back soon. We're always growing and new opportunities are added regularly.
      </p>
    </div>
  );
}

export function CareersUnavailable() {
  return (
    <div className="rounded-3xl border border-amber-200 bg-white/80 px-5 py-12 text-center shadow-[0_8px_30px_rgb(0,0,0,0.04)] backdrop-blur-xl sm:px-8 sm:py-16">
      <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-amber-50 text-amber-600">
        <WifiOff className="h-6 w-6" />
      </span>
      <h2 className="mt-6 text-xl font-extrabold text-slate-900">
        Open roles are temporarily unavailable
      </h2>
      <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-slate-500">
        We could not securely connect to the recruitment service. Please try
        again shortly; no application information has been lost.
      </p>
      <a
        href="/careers"
        className="mt-6 inline-flex h-11 items-center justify-center gap-2 rounded-full bg-slate-900 px-5 text-sm font-bold text-white transition hover:bg-brand-600"
      >
        <RefreshCw className="h-4 w-4" /> Try again
      </a>
    </div>
  );
}
