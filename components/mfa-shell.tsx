import Image from "next/image";
import { LogOut, ShieldCheck } from "lucide-react";
import { signOut } from "@/app/actions/account";
import payrollLogo from "../Payroll-logo-removebg.png";

export function MfaShell({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden bg-sand px-4 py-10">
      <div className="pointer-events-none absolute -left-32 top-20 h-80 w-80 rounded-full bg-brand-100/70 blur-3xl" />
      <div className="pointer-events-none absolute -right-32 bottom-10 h-80 w-80 rounded-full bg-blue-100/60 blur-3xl" />
      <section className="relative w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl ring-1 ring-slate-200/70 sm:p-8">
        <Image src={payrollLogo} alt="Priority Handling Logistics, Inc." priority className="h-14 w-auto" />
        <div className="mt-7 flex items-center gap-2 text-xs font-bold uppercase tracking-[.14em] text-brand-600">
          <ShieldCheck className="h-4 w-4" /> {eyebrow}
        </div>
        <h1 className="mt-3 text-3xl font-black tracking-[-.04em] text-slate-900">{title}</h1>
        <p className="mt-3 text-sm leading-6 text-slate-500">{description}</p>
        {children}
        <form action={signOut} className="mt-6 border-t border-slate-100 pt-5 text-center">
          <button className="inline-flex items-center gap-2 text-xs font-bold text-slate-500 transition-colors hover:text-rose-600">
            <LogOut className="h-4 w-4" />
            Sign out and use another account
          </button>
        </form>
      </section>
    </main>
  );
}
