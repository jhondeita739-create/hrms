"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, LoaderCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export function MfaVerification({ nextPath }: { nextPath: string }) {
  const router = useRouter();
  const initialized = useRef(false);
  const [factorId, setFactorId] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    const supabase = createClient();
    void (async () => {
      const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (aal?.currentLevel === "aal2") {
        router.replace(nextPath);
        return;
      }
      const { data, error: listError } = await supabase.auth.mfa.listFactors();
      if (listError) setError(listError.message);
      else if (data?.totp?.[0]) setFactorId(data.totp[0].id);
      else {
        router.replace(`/mfa/setup?next=${encodeURIComponent(nextPath)}`);
        return;
      }
      setLoading(false);
    })();
  }, [nextPath, router]);

  async function verify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!factorId || code.length !== 6) return;
    setVerifying(true);
    setError("");
    const supabase = createClient();
    const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
    if (verifyError) {
      setError(verifyError.message);
      setCode("");
      setVerifying(false);
      return;
    }
    router.replace(nextPath);
    router.refresh();
  }

  if (loading)
    return <div className="mt-8 grid min-h-36 place-items-center"><LoaderCircle className="h-7 w-7 animate-spin text-brand-600" /></div>;

  return (
    <form onSubmit={verify} className="mt-7 space-y-4">
      {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</div>}
      <label className="block"><span className="field-label">Authentication code</span><input autoFocus value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" required placeholder="000000" className="field-control h-14 text-center font-mono text-xl tracking-[.35em]" /></label>
      <button disabled={verifying || !factorId || code.length !== 6} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand-600 text-sm font-bold text-white shadow-lg shadow-brand-600/15 transition hover:bg-brand-500 disabled:cursor-not-allowed disabled:opacity-50"><KeyRound className="h-4 w-4" />{verifying ? "Verifying…" : "Verify and continue"}</button>
      <p className="text-center text-xs leading-5 text-slate-500">Open your authenticator application and enter the current code for HRMS.</p>
    </form>
  );
}
