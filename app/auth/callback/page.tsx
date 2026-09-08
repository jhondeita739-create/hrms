"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { LoaderCircle, ShieldCheck } from "lucide-react";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import payrollLogo from "../../../Payroll-logo-removebg.png";

const otpTypes = new Set<EmailOtpType>([
  "email",
  "invite",
  "magiclink",
  "recovery",
  "signup",
  "email_change",
]);

function safeDestination(value: string | null) {
  return value?.startsWith("/") && !value.startsWith("//")
    ? value
    : "/account/set-password";
}

export default function AuthCallbackPage() {
  const router = useRouter();
  const [message, setMessage] = useState("Verifying your secure invitation…");

  useEffect(() => {
    let active = true;

    async function completeAuthentication() {
      const current = new URL(window.location.href);
      const hash = new URLSearchParams(current.hash.replace(/^#/, ""));
      const destination = safeDestination(current.searchParams.get("next"));
      const authError =
        hash.get("error_description") ||
        current.searchParams.get("error_description") ||
        hash.get("error") ||
        current.searchParams.get("error");

      if (authError) {
        router.replace(`/login?error=${encodeURIComponent(authError)}`);
        return;
      }

      const supabase = createClient();
      const accessToken = hash.get("access_token");
      const refreshToken = hash.get("refresh_token");
      const code = current.searchParams.get("code");
      const tokenHash = current.searchParams.get("token_hash");
      const rawType = current.searchParams.get("type") as EmailOtpType | null;
      let error: Error | null = null;

      if (accessToken && refreshToken) {
        const result = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        error = result.error;
      } else if (code) {
        const result = await supabase.auth.exchangeCodeForSession(code);
        error = result.error;
      } else if (tokenHash && rawType && otpTypes.has(rawType)) {
        const result = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: rawType,
        });
        error = result.error;
      } else {
        const { data, error: sessionError } = await supabase.auth.getSession();
        error = sessionError;
        if (!data.session && !error) {
          error = new Error("The invitation link is incomplete or has expired.");
        }
      }

      if (!active) return;
      if (error) {
        setMessage("The invitation could not be verified.");
        router.replace(`/login?error=${encodeURIComponent(error.message)}`);
        return;
      }

      setMessage("Invitation verified. Opening your account…");
      router.replace(destination);
      router.refresh();
    }

    void completeAuthentication();
    return () => {
      active = false;
    };
  }, [router]);

  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 px-4 py-10">
      <section className="w-full max-w-md rounded-3xl bg-white p-7 text-center shadow-2xl ring-1 ring-slate-200/70 sm:p-9">
        <Image
          src={payrollLogo}
          alt="Priority Handling Logistics, Inc."
          priority
          className="mx-auto h-16 w-auto object-contain"
        />
        <span className="mx-auto mt-8 grid h-12 w-12 place-items-center rounded-2xl bg-brand-50 text-brand-600">
          <ShieldCheck className="h-6 w-6" />
        </span>
        <h1 className="mt-5 text-2xl font-extrabold text-slate-950">
          Activating secure access
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">{message}</p>
        <LoaderCircle className="mx-auto mt-6 h-5 w-5 animate-spin text-brand-600" />
      </section>
    </main>
  );
}
