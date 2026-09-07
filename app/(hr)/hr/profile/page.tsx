import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { BadgeCheck, KeyRound, Mail, ShieldCheck } from "lucide-react";
import { ProfileForm } from "@/components/profile-form";
import { initials } from "@/lib/utils";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "My profile" };

type RoleRelation = { name?: string; key?: string } | { name?: string; key?: string }[] | null;

export default async function ProfilePage() {
  let fullName = "Alex Morgan";
  let jobTitle = "HR Administrator";
  let email = "alex@company.com";
  let roleName = "Super administrator";
  let status = "Preview account";

  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect("/login");

    const [{ data: profile }, { data: assignments }] = await Promise.all([
      supabase
        .from("profiles")
        .select("full_name,job_title,status")
        .eq("id", user.id)
        .maybeSingle(),
      supabase
        .from("user_roles")
        .select("roles(name,key)")
        .eq("user_id", user.id),
    ]);

    const roles = (assignments ?? []).flatMap((assignment) => {
      const relation = assignment.roles as RoleRelation;
      return Array.isArray(relation) ? relation : relation ? [relation] : [];
    });
    const preferredRole =
      roles.find((role) => role.key === "super_admin") ?? roles[0];

    fullName = profile?.full_name || user.email?.split("@")[0] || "HR user";
    jobTitle = profile?.job_title || "";
    email = user.email || "No email available";
    roleName = preferredRole?.name || "Team member";
    status = profile?.status === "active" ? "Active account" : profile?.status || "Active account";
  }

  return (
    <div className="mx-auto w-full max-w-6xl">
      <header className="mb-8">
        <p className="mb-2 text-xs font-bold uppercase tracking-[.16em] text-brand-600">
          Account
        </p>
        <h1 className="text-3xl font-extrabold tracking-[-.04em] text-slate-900 sm:text-4xl">
          My profile
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500 sm:text-base">
          Keep your identity and role details accurate across the HRMS workspace.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="rounded-3xl bg-white p-5 shadow-[0_8px_30px_rgb(15,23,42,0.05)] ring-1 ring-slate-200/70 sm:p-7">
          <div className="mb-7 flex items-center gap-4 border-b border-slate-100 pb-6">
            <span className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-brand-100 text-xl font-extrabold text-brand-700">
              {initials(fullName)}
            </span>
            <div className="min-w-0">
              <h2 className="truncate text-lg font-extrabold text-slate-900">{fullName}</h2>
              <p className="mt-1 truncate text-sm text-slate-500">{jobTitle || roleName}</p>
            </div>
          </div>
          <ProfileForm fullName={fullName} jobTitle={jobTitle} email={email} />
        </section>

        <aside className="space-y-5">
          <section className="rounded-3xl bg-white p-5 shadow-[0_8px_30px_rgb(15,23,42,0.05)] ring-1 ring-slate-200/70">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-50 text-brand-700">
                <ShieldCheck className="h-5 w-5" />
              </span>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[.14em] text-slate-400">Assigned role</p>
                <p className="mt-1 text-sm font-extrabold text-slate-900">{roleName}</p>
              </div>
            </div>
            <div className="mt-5 flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2.5 text-xs font-bold text-emerald-700">
              <BadgeCheck className="h-4 w-4" />
              {status}
            </div>
          </section>

          <section className="rounded-3xl border border-brand-100 bg-brand-50/60 p-5">
            <div className="flex items-center gap-2 text-sm font-extrabold text-brand-900">
              <KeyRound className="h-4 w-4" />
              Account security
            </div>
            <p className="mt-3 text-xs leading-5 text-brand-800/80">
              Your authenticator app provides the required second verification step for protected HR records.
            </p>
            <div className="mt-4 flex min-w-0 items-center gap-2 border-t border-brand-100 pt-4 text-xs text-brand-800">
              <Mail className="h-4 w-4 shrink-0" />
              <span className="truncate">{email}</span>
            </div>
            <Link
              href="/account/security"
              className="mt-4 inline-flex h-10 w-full items-center justify-center rounded-xl bg-brand-600 px-4 text-xs font-bold text-white transition-colors hover:bg-brand-700"
            >
              Manage MFA
            </Link>
          </section>
        </aside>
      </div>
    </div>
  );
}
