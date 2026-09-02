"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  Bell,
  BriefcaseBusiness,
  Building2,
  CheckCheck,
  ChevronDown,
  CircleUserRound,
  ClipboardCheck,
  FileText,
  Gauge,
  Menu,
  PanelLeftClose,
  Search,
  Settings,
  Users,
  X,
} from "lucide-react";
import { cn, initials } from "@/lib/utils";
import payrollLogo from "../Payroll-logo-removebg.png";

const groups = [
  {
    label: "Workspace",
    items: [{ href: "/hr/dashboard", label: "Overview", icon: Gauge }],
  },
  {
    label: "Recruitment & onboarding",
    items: [
      {
        href: "/hr/recruitment/applicants",
        label: "Applicants",
        icon: CircleUserRound,
      },
      {
        href: "/hr/recruitment/vacancies",
        label: "Job vacancies",
        icon: BriefcaseBusiness,
      },
      { href: "/hr/onboarding", label: "Onboarding", icon: ClipboardCheck },
    ],
  },
  {
    label: "Core HR",
    items: [
      { href: "/hr/employees", label: "Employees", icon: Users },
      { href: "/hr/organization", label: "Organization", icon: Building2 },
      { href: "/hr/records", label: "Employee records", icon: FileText },
    ],
  },
];

export function AppShell({
  children,
  userName,
  userEmail,
  demo = false,
}: {
  children: React.ReactNode;
  userName: string;
  userEmail: string;
  demo?: boolean;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notificationsRead, setNotificationsRead] = useState(false);
  const [query, setQuery] = useState("");
  const commands = [
    ...groups.flatMap((group) =>
      group.items.map((item) => ({ ...item, group: group.label })),
    ),
    { href: "/hr/settings", label: "Settings", icon: Settings, group: "Administration" },
  ];
  const filteredCommands = commands.filter((item) =>
    `${item.label} ${item.group}`.toLowerCase().includes(query.toLowerCase()),
  );

  useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen((current) => !current);
      }
      if (event.key === "Escape") {
        setSearchOpen(false);
        setNotificationsOpen(false);
      }
    }
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, []);

  useEffect(() => {
    setSearchOpen(false);
    setNotificationsOpen(false);
    setMobileOpen(false);
  }, [pathname]);
  const navigation = (
    <>
      <div
        className={cn(
          "flex items-center px-4",
          collapsed
            ? "h-20 flex-col justify-center gap-1"
            : "h-16 justify-between",
        )}
      >
        <Link
          href="/hr/dashboard"
          aria-label="Priority Handling Logistics HRMS dashboard"
          className={cn(
            "shrink-0 overflow-hidden rounded-lg transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500",
            collapsed ? "h-9 w-9" : "h-11 w-11",
          )}
        >
          <Image
            src={payrollLogo}
            alt="Priority Handling Logistics, Inc."
            priority
            className={cn(
              "max-w-none",
              collapsed ? "h-9 w-auto" : "h-11 w-auto",
            )}
          />
        </Link>
        <button
          aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
          title={collapsed ? "Expand navigation" : "Collapse navigation"}
          onClick={() => setCollapsed(!collapsed)}
          className="group hidden h-9 w-9 shrink-0 place-items-center rounded-md text-slate-500 transition-[background-color,color,transform] duration-200 hover:scale-105 hover:bg-slate-100 hover:text-slate-900 lg:grid"
        >
          {collapsed ? (
            <Menu className="h-4 w-4" />
          ) : (
            <PanelLeftClose className="h-[18px] w-[18px]" />
          )}
        </button>
        <button
          aria-label="Close navigation"
          onClick={() => setMobileOpen(false)}
          className="lg:hidden"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
      <nav className="scrollbar-thin flex-1 overflow-y-auto px-3 py-4">
        {groups.map((group) => (
          <div className="mb-6" key={group.label}>
            {!collapsed && (
              <div className="mb-2 flex items-center justify-between px-3 text-[10px] font-semibold uppercase tracking-[.16em] text-slate-400">
                <span>{group.label}</span>
                <ChevronDown className="h-3 w-3" />
              </div>
            )}
            <div className="space-y-1">
              {group.items.map((item) => {
                const active =
                  pathname === item.href ||
                  (item.href !== "/hr/dashboard" &&
                    pathname.startsWith(item.href));
                return (
                  <Link
                    aria-current={active ? "page" : undefined}
                    title={collapsed ? item.label : undefined}
                    onClick={() => setMobileOpen(false)}
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "group flex h-10 items-center gap-3 rounded-md px-3 text-sm font-medium transition",
                      active
                        ? "bg-brand-50 text-brand-700"
                        : "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
                    )}
                  >
                    <item.icon
                      className={cn(
                        "h-[18px] w-[18px] shrink-0 transition-[color,transform] duration-200 group-hover:scale-105",
                        active
                          ? "text-brand-600"
                          : "text-slate-400 group-hover:text-slate-600",
                      )}
                    />
                    {!collapsed && <span>{item.label}</span>}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
      <div className="border-t border-slate-100 p-3">
        <Link
          href="/hr/settings"
          className="group flex h-10 items-center gap-3 rounded-md px-3 text-sm font-medium text-slate-600 transition-colors duration-200 hover:bg-slate-50 hover:text-slate-900"
        >
          <Settings className="h-[18px] w-[18px] text-slate-400 transition-transform duration-200 group-hover:scale-105" />
          {!collapsed && "Settings"}
        </Link>
      </div>
    </>
  );
  return (
    <div className="min-h-screen bg-sand">
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 hidden border-r border-slate-200 bg-white transition-[width] lg:flex lg:flex-col",
          collapsed ? "w-[72px]" : "w-[244px]",
        )}
      >
        {navigation}
      </aside>
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            aria-label="Close menu"
            className="absolute inset-0 bg-slate-900/30"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="relative flex h-full w-[280px] flex-col bg-white shadow-xl">
            {navigation}
          </aside>
        </div>
      )}
      <div
        className={cn(
          "transition-[padding]",
          collapsed ? "lg:pl-[72px]" : "lg:pl-[244px]",
        )}
      >
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200 bg-white/95 px-4 backdrop-blur md:px-7">
          <div className="flex items-center gap-3">
            <button
              aria-label="Open navigation"
              className="grid h-9 w-9 place-items-center rounded-md border border-slate-200 transition-[background-color,transform] duration-200 hover:scale-105 hover:bg-slate-50 lg:hidden"
              onClick={() => {
                setCollapsed(false);
                setMobileOpen(true);
              }}
            >
              <Menu className="h-5 w-5" />
            </button>
            <button
              type="button"
              aria-label="Search HRMS"
              onClick={() => setSearchOpen(true)}
              className="hidden h-10 w-[300px] items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/70 px-3 text-left text-sm text-slate-400 transition-colors hover:border-brand-200 hover:bg-white md:flex"
            >
              <Search className="h-4 w-4" />
              <span className="flex-1">Search people and records</span>
              <kbd className="rounded border bg-white px-1.5 py-0.5 text-[10px]">
                ⌘ K
              </kbd>
            </button>
            {demo && (
              <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold text-amber-800">
                Preview mode
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label="Search HRMS"
              onClick={() => {
                setSearchOpen(true);
                setNotificationsOpen(false);
              }}
              className="grid h-10 w-10 place-items-center rounded-xl text-slate-500 transition-colors hover:bg-slate-50 md:hidden"
            >
              <Search className="h-[18px] w-[18px]" />
            </button>
            <button
              type="button"
              aria-label="Open notifications"
              aria-expanded={notificationsOpen}
              onClick={() => {
                setNotificationsOpen((current) => !current);
                setSearchOpen(false);
              }}
              className="group relative grid h-10 w-10 place-items-center rounded-xl text-slate-500 transition-[background-color,transform] duration-200 hover:scale-105 hover:bg-slate-50 motion-reduce:transform-none"
            >
              <Bell className="h-[18px] w-[18px] transition-transform duration-200 group-hover:-rotate-6" />
              {!notificationsRead && (
                <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-amber-500 ring-2 ring-white" />
              )}
            </button>
            <div className="ml-1 flex items-center gap-3 border-l border-slate-200 pl-3">
              <span className="grid h-8 w-8 place-items-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">
                {initials(userName)}
              </span>
              <div className="hidden leading-tight sm:block">
                <div className="text-xs font-semibold text-slate-800">
                  {userName}
                </div>
                <div className="mt-1 max-w-[160px] truncate text-[11px] text-slate-400">
                  {userEmail}
                </div>
              </div>
            </div>
          </div>
        </header>
        {notificationsOpen && (
          <>
            <button
              type="button"
              aria-label="Close notifications"
              className="fixed inset-0 z-40 cursor-default bg-transparent"
              onClick={() => setNotificationsOpen(false)}
            />
            <section
              aria-label="Notifications"
              className="fixed right-4 top-[72px] z-50 w-[calc(100vw-2rem)] max-w-sm overflow-hidden rounded-3xl bg-white shadow-2xl ring-1 ring-slate-200 sm:right-6"
            >
              <div className="flex items-start justify-between border-b border-slate-100 p-5">
                <div>
                  <h2 className="text-base font-extrabold text-slate-900">Notifications</h2>
                  <p className="mt-1 text-xs text-slate-500">Operational updates that need attention.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setNotificationsRead(true)}
                  className="flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1.5 text-[11px] font-bold text-brand-700 hover:bg-brand-100"
                >
                  <CheckCheck className="h-3.5 w-3.5" />
                  Mark read
                </button>
              </div>
              <div className="p-2">
                <NotificationLink
                  href="/hr/recruitment/applicants"
                  icon={CircleUserRound}
                  title="7 applicants await review"
                  text="New applications received today"
                  unread={!notificationsRead}
                />
                <NotificationLink
                  href="/hr/records"
                  icon={FileText}
                  title="12 documents expiring"
                  text="Within the next 60 days"
                  unread={!notificationsRead}
                />
                <NotificationLink
                  href="/hr/onboarding"
                  icon={ClipboardCheck}
                  title="3 onboarding tasks due"
                  text="Due before the next start date"
                  unread={!notificationsRead}
                />
              </div>
            </section>
          </>
        )}
        {searchOpen && (
          <div className="fixed inset-0 z-[70] flex items-start justify-center px-4 pt-[10vh] sm:pt-[14vh]">
            <button
              type="button"
              aria-label="Close search"
              className="absolute inset-0 bg-slate-950/35 backdrop-blur-sm"
              onClick={() => setSearchOpen(false)}
            />
            <section
              role="dialog"
              aria-modal="true"
              aria-label="Search HRMS"
              className="relative w-full max-w-xl overflow-hidden rounded-3xl bg-white shadow-2xl ring-1 ring-white/60"
            >
              <div className="relative border-b border-slate-100 p-4">
                <Search className="absolute left-7 top-7 h-5 w-5 text-slate-400" />
                <input
                  autoFocus
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search pages and workspaces…"
                  className="h-12 w-full rounded-2xl bg-slate-50 pl-12 pr-4 text-sm font-medium text-slate-900 outline-none ring-brand-100 placeholder:text-slate-400 focus:ring-4"
                />
              </div>
              <div className="max-h-[55vh] overflow-y-auto p-2">
                <p className="px-3 pb-2 pt-2 text-[10px] font-bold uppercase tracking-[.16em] text-slate-400">
                  Navigate
                </p>
                {filteredCommands.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setSearchOpen(false)}
                    className="group flex items-center gap-3 rounded-2xl p-3 transition-colors hover:bg-brand-50"
                  >
                    <span className="grid h-10 w-10 place-items-center rounded-xl bg-slate-100 text-slate-500 transition-colors group-hover:bg-white group-hover:text-brand-700">
                      <item.icon className="h-[18px] w-[18px]" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-bold text-slate-800">{item.label}</span>
                      <span className="mt-0.5 block text-xs text-slate-400">{item.group}</span>
                    </span>
                    <ArrowRight className="h-4 w-4 text-slate-300 transition-transform group-hover:translate-x-0.5" />
                  </Link>
                ))}
                {!filteredCommands.length && (
                  <div className="grid min-h-36 place-items-center px-6 text-center">
                    <div>
                      <p className="text-sm font-bold text-slate-700">No workspace found</p>
                      <p className="mt-1 text-xs text-slate-400">Try applicants, employees, or onboarding.</p>
                    </div>
                  </div>
                )}
              </div>
              <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/70 px-5 py-3 text-[11px] text-slate-400">
                <span>Press Esc to close</span>
                <kbd className="rounded-lg border border-slate-200 bg-white px-2 py-1 font-semibold text-slate-500">Ctrl K</kbd>
              </div>
            </section>
          </div>
        )}
        <main className="mx-auto w-full max-w-[1800px] px-4 py-6 sm:px-5 md:px-7 md:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}

function NotificationLink({
  href,
  icon: Icon,
  title,
  text,
  unread,
}: {
  href: string;
  icon: typeof Bell;
  title: string;
  text: string;
  unread: boolean;
}) {
  return (
    <Link
      href={href}
      className="group flex items-start gap-3 rounded-2xl p-3 transition-colors hover:bg-slate-50"
    >
      <span className="relative grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700">
        <Icon className="h-[18px] w-[18px]" />
        {unread && (
          <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-amber-500 ring-2 ring-white" />
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-bold text-slate-800">{title}</span>
        <span className="mt-1 block text-[11px] text-slate-400">{text}</span>
      </span>
      <ArrowRight className="mt-3 h-3.5 w-3.5 text-slate-300 transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}
