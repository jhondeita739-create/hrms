"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Copy, LoaderCircle, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Enrollment = {
  id: string;
  qrCode: string;
  secret: string;
};

export function MfaEnrollment({ nextPath }: { nextPath: string }) {
  const router = useRouter();
  const initialized = useRef(false);
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    const supabase = createClient();
    void (async () => {
      const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors();
      if (factorsError) {
        setError(factorsError.message);
        setLoading(false);
        return;
      }
      const verified = factors?.totp?.[0];
      if (verified) {
        router.replace(
          aal?.currentLevel === "aal2"
            ? nextPath
            : `/mfa/verify?next=${encodeURIComponent(nextPath)}`,
        );
        return;
      }
      for (const factor of factors?.all?.filter((item) => item.status === "unverified") || []) {
        await supabase.auth.mfa.unenroll({ factorId: factor.id });
      }
      const { data, error: enrollError } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "HRMS Authenticator",
        issuer: "HRMS",
      });
      if (enrollError || !data || data.type !== "totp") {
        setError(enrollError?.message || "Authenticator enrollment could not be started.");
        setLoading(false);
        return;
      }
      setEnrollment({ id: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret });
      setLoading(false);
    })();
  }, [nextPath, router]);

  async function verify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!enrollment || code.length !== 6) return;
    setVerifying(true);
    setError("");
    const supabase = createClient();
    const { data: verification, error: verifyError } = await supabase.auth.mfa.challengeAndVerify({
      factorId: enrollment.id,
      code,
    });
    if (verifyError) {
      setError(verifyError.message);
      setCode("");
      setVerifying(false);
      return;
    }
    if (verification?.user) {
      await supabase
        .from("profiles")
        .update({ status: "active" })
        .eq("id", verification.user.id);
    }
    router.replace(nextPath);
    router.refresh();
  }

  async function copySecret() {
    if (!enrollment) return;
    await navigator.clipboard.writeText(enrollment.secret);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  if (loading)
    return (
      <div className="mt-8 grid min-h-52 place-items-center rounded-2xl bg-slate-50">
        <div className="text-center"><LoaderCircle className="mx-auto h-7 w-7 animate-spin text-brand-600" /><p className="mt-3 text-sm font-semibold text-slate-500">Preparing secure enrollment…</p></div>
      </div>
    );

  return (
    <div className="mt-7">
      {error && <div role="alert" className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</div>}
      {enrollment && (
        <>
          <div className="grid gap-5 rounded-2xl border border-slate-200 bg-slate-50 p-5 sm:grid-cols-[180px_1fr] sm:items-center">
            {/* Supabase returns a local SVG data URI, not a remote resource. */}
            <img src={enrollment.qrCode} alt="Authenticator enrollment QR code" className="mx-auto h-[180px] w-[180px] rounded-xl bg-white p-2 ring-1 ring-slate-200" />
            <div><p className="text-sm font-extrabold text-slate-900">1. Scan the QR code</p><p className="mt-2 text-xs leading-5 text-slate-500">Use Google Authenticator, Microsoft Authenticator, 1Password, Authy, or another TOTP application.</p><p className="mt-4 text-xs font-bold text-slate-700">Manual setup key</p><button type="button" onClick={copySecret} className="mt-2 flex w-full items-center gap-2 rounded-xl bg-white px-3 py-2.5 text-left font-mono text-xs font-bold text-slate-700 ring-1 ring-slate-200"><span className="min-w-0 flex-1 break-all">{enrollment.secret}</span>{copied ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" /> : <Copy className="h-4 w-4 shrink-0 text-slate-400" />}</button></div>
          </div>
          <form onSubmit={verify} className="mt-6">
            <label className="field-label" htmlFor="mfa-enrollment-code">2. Enter the six-digit code</label>
            <input id="mfa-enrollment-code" value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" required placeholder="000000" className="field-control h-14 text-center font-mono text-xl tracking-[.35em]" />
            <button disabled={verifying || code.length !== 6} className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand-600 text-sm font-bold text-white shadow-lg shadow-brand-600/15 transition hover:bg-brand-500 disabled:cursor-not-allowed disabled:opacity-50"><ShieldCheck className="h-4 w-4" />{verifying ? "Verifying…" : "Enable MFA and continue"}</button>
          </form>
        </>
      )}
    </div>
  );
}
