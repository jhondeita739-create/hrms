import type { Metadata } from "next";
import { SettingsWorkspace } from "@/components/settings-workspace";
import { getAdminAccessData } from "@/lib/admin-access-data";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const accessData = await getAdminAccessData();
  return (
    <>
      <header className="mb-8">
        <p className="mb-2 text-xs font-bold uppercase tracking-[.16em] text-brand-600">
          Administration
        </p>
        <h1 className="text-3xl font-extrabold tracking-[-.04em] text-slate-900 sm:text-4xl">
          Settings
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500 sm:text-base">
          Configure security, storage, notifications, and shared HR administration.
        </p>
      </header>
      <SettingsWorkspace accessData={accessData} />
    </>
  );
}
