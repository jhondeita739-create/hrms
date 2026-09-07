"use client";

import { useActionState } from "react";
import { KeyRound } from "lucide-react";
import {
  setInitialPassword,
  type PasswordActionState,
} from "@/app/actions/account";

const initialState: PasswordActionState = { status: "idle", message: "" };

export function SetPasswordForm() {
  const [state, action, pending] = useActionState(setInitialPassword, initialState);
  return (
    <form action={action} className="mt-7 space-y-5">
      {state.status === "error" && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
          {state.message}
        </div>
      )}
      <label className="block">
        <span className="field-label">Create password</span>
        <input name="password" type="password" minLength={8} required autoComplete="new-password" className="field-control" />
        <span className="mt-2 block text-xs text-slate-500">Use at least 8 characters.</span>
      </label>
      <label className="block">
        <span className="field-label">Confirm password</span>
        <input name="confirm_password" type="password" minLength={8} required autoComplete="new-password" className="field-control" />
      </label>
      <button disabled={pending} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand-600 text-sm font-bold text-white shadow-lg shadow-brand-600/15 transition hover:bg-brand-500 disabled:opacity-60">
        <KeyRound className="h-4 w-4" />
        {pending ? "Activating…" : "Activate temporary account"}
      </button>
    </form>
  );
}
