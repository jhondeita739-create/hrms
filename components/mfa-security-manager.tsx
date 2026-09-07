"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, LoaderCircle, RefreshCw, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Factor = { id: string; friendly_name?: string; created_at: string; updated_at: string };

export function MfaSecurityManager({ returnPath = "/hr/profile" }: { returnPath?: string }) {
  const router = useRouter();
  const initialized = useRef(false);
  const [factor, setFactor] = useState<Factor | null>(null);
  const [loading, setLoading] = useState(true);
  const [resetting, setResetting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    const supabase = createClient();
    void supabase.auth.mfa.listFactors().then(({ data, error: listError }) => {
      if (listError) setError(listError.message);
      else setFactor((data?.totp?.[0] as Factor | undefined) || null);
      setLoading(false);
    });
  }, []);

  async function reset() {
    if (!factor) {
      router.push(`/mfa/setup?next=${encodeURIComponent(returnPath)}`);
      return;
    }
    if (!window.confirm("Reset your authenticator? You will immediately need to enroll a new MFA factor.")) return;
    setResetting(true);
    setError("");
    const supabase = createClient();
    const { error: removeError } = await supabase.auth.mfa.unenroll({ factorId: factor.id });
    if (removeError) {
      setError(removeError.message);
      setResetting(false);
      return;
    }
    await supabase.auth.refreshSession();
    router.replace(`/mfa/setup?next=${encodeURIComponent(returnPath)}`);
    router.refresh();
  }

  if (loading) return <div className="grid min-h-28 place-items-center"><LoaderCircle className="h-5 w-5 animate-spin text-brand-600" /></div>;

  return (
    <div>
      {error && <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">{error}</div>}
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-700"><ShieldCheck className="h-5 w-5" /></span>
        <div className="min-w-0 flex-1"><div className="flex items-center gap-2"><h3 className="text-sm font-extrabold text-slate-900">Authenticator app</h3>{factor && <CheckCircle2 className="h-4 w-4 text-emerald-600" />}</div><p className="mt-1 text-xs leading-5 text-slate-500">{factor ? `${factor.friendly_name || "TOTP authenticator"} is protecting your account.` : "No verified authenticator is enrolled."}</p>{factor && <p className="mt-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Added {new Date(factor.created_at).toLocaleDateString()}</p>}</div>
      </div>
      <button type="button" disabled={resetting} onClick={reset} className="mt-5 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"><RefreshCw className="h-4 w-4" />{resetting ? "Resetting…" : factor ? "Reset authenticator" : "Enable MFA"}</button>
    </div>
  );
}
