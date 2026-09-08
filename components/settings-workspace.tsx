"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  ChevronDown,
  Database,
  KeyRound,
  Save,
  ShieldCheck,
  UserCog,
} from "lucide-react";
import { setHrUserRole, type AdminAccessResult } from "@/app/actions/admin-access";
import type { AdminAccessData } from "@/lib/admin-access-data";
import { cn } from "@/lib/utils";

type Preferences = {
  requireMfa: boolean;
  sensitiveExports: boolean;
  documentVersioning: boolean;
  applicantUpdates: boolean;
  documentReminders: boolean;
  sessionTimeout: string;
  retention: string;
};

const defaults: Preferences = {
  requireMfa: true,
  sensitiveExports: true,
  documentVersioning: true,
  applicantUpdates: true,
  documentReminders: true,
  sessionTimeout: "8 hours",
  retention: "7 years",
};

export function SettingsWorkspace({ accessData }: { accessData: AdminAccessData }) {
  const [open, setOpen] = useState("Roles & permissions");
  const [preferences, setPreferences] = useState(defaults);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem("hrms-admin-preferences");
    if (stored) {
      try {
        setPreferences({ ...defaults, ...JSON.parse(stored) });
      } catch {
        window.localStorage.removeItem("hrms-admin-preferences");
      }
    }
  }, []);

  function update<K extends keyof Preferences>(key: K, value: Preferences[K]) {
    setSaved(false);
    setPreferences((current) => ({ ...current, [key]: value }));
  }

  function save() {
    window.localStorage.setItem(
      "hrms-admin-preferences",
      JSON.stringify(preferences),
    );
    setSaved(true);
  }

  const sections = [
    {
      icon: ShieldCheck,
      title: "Roles & permissions",
      text: "Control access to sensitive HR records and exports.",
      content: (
        <div className="grid gap-3 sm:grid-cols-2">
          <SettingToggle
            label="Protect sensitive exports"
            description="Require elevated permission before confidential records can be exported."
            checked={preferences.sensitiveExports}
            onChange={(value) => update("sensitiveExports", value)}
          />
          <InfoCard
            title="Permission model"
            text="Organization-scoped roles continue to be enforced by Supabase row-level security."
          />
          <div className="sm:col-span-2">
            <UserAccessManager data={accessData} />
          </div>
        </div>
      ),
    },
    {
      icon: KeyRound,
      title: "Authentication",
      text: "Configure session security and login safeguards.",
      content: (
        <div className="grid gap-3 sm:grid-cols-2">
          <SettingToggle
            label="Require administrator MFA"
            description="Prompt HR administrators for an additional authentication factor."
            checked={preferences.requireMfa}
            onChange={(value) => update("requireMfa", value)}
          />
          <SettingSelect
            label="Session timeout"
            description="Preferred inactivity window for this browser."
            value={preferences.sessionTimeout}
            options={["1 hour", "4 hours", "8 hours", "24 hours"]}
            onChange={(value) => update("sessionTimeout", value)}
          />
        </div>
      ),
    },
    {
      icon: Database,
      title: "Data & storage",
      text: "Set retention and document-version preferences.",
      content: (
        <div className="grid gap-3 sm:grid-cols-2">
          <SettingSelect
            label="Record retention"
            description="Default retention preference for archived HR records."
            value={preferences.retention}
            options={["3 years", "5 years", "7 years", "Indefinite"]}
            onChange={(value) => update("retention", value)}
          />
          <SettingToggle
            label="Document versioning"
            description="Keep prior files when a document is replaced."
            checked={preferences.documentVersioning}
            onChange={(value) => update("documentVersioning", value)}
          />
        </div>
      ),
    },
    {
      icon: Bell,
      title: "Notifications",
      text: "Choose which operational reminders appear in HRMS.",
      content: (
        <div className="grid gap-3 sm:grid-cols-2">
          <SettingToggle
            label="Applicant updates"
            description="Show reminders for new applications and stage changes."
            checked={preferences.applicantUpdates}
            onChange={(value) => update("applicantUpdates", value)}
          />
          <SettingToggle
            label="Document reminders"
            description="Show reminders before employee documents expire."
            checked={preferences.documentReminders}
            onChange={(value) => update("documentReminders", value)}
          />
        </div>
      ),
    },
  ];

  return (
    <div className="overflow-hidden rounded-3xl bg-white shadow-[0_8px_30px_rgb(15,23,42,0.05)] ring-1 ring-slate-200/70">
      {sections.map(({ icon: Icon, title, text, content }) => {
        const expanded = open === title;
        return (
          <section className="border-b border-slate-100 last:border-0" key={title}>
            <button
              type="button"
              aria-expanded={expanded}
              onClick={() => setOpen(expanded ? "" : title)}
              className="group flex w-full items-center gap-4 p-5 text-left transition-colors hover:bg-slate-50/70 sm:p-6"
            >
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-brand-50 text-brand-700 transition-transform duration-200 group-hover:scale-105 motion-reduce:transform-none">
                <Icon className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-extrabold text-slate-900">{title}</span>
                <span className="mt-1 block text-xs leading-5 text-slate-500">{text}</span>
              </span>
              <ChevronDown
                className={cn(
                  "h-4 w-4 text-slate-400 transition-transform duration-200",
                  expanded && "rotate-180",
                )}
              />
            </button>
            <div
              className={cn(
                "grid transition-[grid-template-rows,opacity] duration-300",
                expanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
              )}
            >
              <div className="overflow-hidden">
                <div className="border-t border-slate-100 bg-slate-50/50 p-4 sm:p-6">
                  {content}
                </div>
              </div>
            </div>
          </section>
        );
      })}
      <div className="flex flex-col gap-3 border-t border-slate-100 bg-white p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <p className="text-xs leading-5 text-slate-500" aria-live="polite">
          {saved
            ? "Interface preferences saved for this browser."
            : "Security enforcement remains managed by Supabase policies."}
        </p>
        <button
          type="button"
          onClick={save}
          className="flex h-11 items-center justify-center gap-2 rounded-xl bg-brand-600 px-5 text-sm font-bold text-white shadow-sm transition hover:bg-brand-500"
        >
          <Save className="h-4 w-4" />
          Save preferences
        </button>
      </div>
    </div>
  );
}

function UserAccessManager({ data }: { data: AdminAccessData }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [notice, setNotice] = useState<AdminAccessResult | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>(() =>
    Object.fromEntries(data.users.map((user) => [user.id, user.roleId || ""])),
  );

  if (!data.canManage)
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex items-start gap-3">
          <UserCog className="mt-0.5 h-5 w-5 shrink-0 text-slate-400" />
          <div>
            <h3 className="text-sm font-bold text-slate-800">HR user access</h3>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              Only a super administrator with verified MFA can assign or remove HR roles.
            </p>
          </div>
        </div>
      </div>
    );

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="border-b border-slate-100 p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700">
            <UserCog className="h-5 w-5" />
          </span>
          <div>
            <h3 className="text-sm font-bold text-slate-900">HR user access</h3>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              Assign one organization role to each HR account. Changes are enforced immediately by PostgreSQL RLS.
            </p>
          </div>
        </div>
        {notice && (
          <div className={`mt-4 rounded-xl px-3 py-2 text-xs font-semibold ${notice.ok ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
            {notice.message}
          </div>
        )}
      </div>
      <div className="divide-y divide-slate-100">
        {data.users.map((user) => {
          const isSuperAdmin = user.roleKey === "super_admin";
          return (
            <div key={user.id} className="grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_220px_auto] sm:items-center sm:p-5">
              <div className="min-w-0">
                <div className="truncate text-sm font-bold text-slate-900">{user.fullName}</div>
                <div className="mt-1 truncate text-xs text-slate-500">{user.email}</div>
              </div>
              {isSuperAdmin ? (
                <div className="rounded-xl bg-brand-50 px-3 py-2.5 text-xs font-bold text-brand-700">
                  Super administrator
                </div>
              ) : (
                <select
                  value={drafts[user.id] ?? ""}
                  disabled={pending}
                  onChange={(event) =>
                    setDrafts((current) => ({ ...current, [user.id]: event.target.value }))
                  }
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100"
                >
                  <option value="">No HR access</option>
                  {data.roles.map((role) => (
                    <option key={role.id} value={role.id}>{role.name}</option>
                  ))}
                </select>
              )}
              <button
                type="button"
                disabled={pending || isSuperAdmin || (drafts[user.id] ?? "") === (user.roleId || "")}
                onClick={() =>
                  startTransition(async () => {
                    const result = await setHrUserRole({
                      userId: user.id,
                      roleId: drafts[user.id] ?? "",
                    });
                    setNotice(result);
                    if (result.ok) router.refresh();
                  })
                }
                className="h-10 rounded-xl bg-slate-900 px-4 text-xs font-bold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Save role
              </button>
            </div>
          );
        })}
        {!data.users.length && (
          <p className="p-5 text-xs text-slate-500">No HR accounts were found for this organization.</p>
        )}
      </div>
    </div>
  );
}

function SettingToggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-start gap-4 rounded-2xl border border-slate-200 bg-white p-4">
      <div className="min-w-0 flex-1">
        <div className="text-sm font-bold text-slate-800">{label}</div>
        <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition-colors",
          checked ? "bg-brand-600" : "bg-slate-200",
        )}
      >
        <span
          className={cn(
            "absolute left-0 top-1 h-4 w-4 rounded-full bg-white shadow-sm transition-transform",
            checked ? "translate-x-6" : "translate-x-1",
          )}
        />
      </button>
    </div>
  );
}

function SettingSelect({
  label,
  description,
  value,
  options,
  onChange,
}: {
  label: string;
  description: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="block rounded-2xl border border-slate-200 bg-white p-4">
      <span className="text-sm font-bold text-slate-800">{label}</span>
      <span className="mt-1 block text-xs leading-5 text-slate-500">{description}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-3 h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-bold text-slate-700 outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100"
      >
        {options.map((option) => (
          <option key={option}>{option}</option>
        ))}
      </select>
    </label>
  );
}

function InfoCard({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-2xl border border-brand-100 bg-brand-50/70 p-4">
      <div className="text-sm font-bold text-brand-900">{title}</div>
      <p className="mt-1 text-xs leading-5 text-brand-700">{text}</p>
    </div>
  );
}
