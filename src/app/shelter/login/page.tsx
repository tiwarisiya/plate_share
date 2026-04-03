"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabaseClient";
import {
  getCurrentUserRole,
  isShelterProfileComplete,
} from "@/lib/flow";

export default function ShelterLogin() {
  const router = useRouter();
  const [form, setForm] = useState({ email: "", password: "" });
  const [resendEmail, setResendEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const supabase = getSupabaseClient();
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: form.email,
        password: form.password,
      });

      if (signInError) {
        if (signInError.message.includes("Email not confirmed")) {
          setError("Please verify your email before signing in.");
        } else {
          setError(signInError.message);
        }
        setLoading(false);
        return;
      }

      if (!data.user) {
        setError("Failed to sign in.");
        setLoading(false);
        return;
      }

      const role = await getCurrentUserRole(data.user.id);
      if (!role) {
        router.push("/shelter/register/details");
        return;
      }

      if (role !== "shelter") {
        await supabase.auth.signOut();
        setError("This account is registered as a restaurant. Please use the restaurant login.");
        setLoading(false);
        return;
      }

      const isComplete = await isShelterProfileComplete(data.user.id);

      if (!isComplete) {
        router.push("/shelter/register/details");
        return;
      }

      router.push("/shelter/home");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Sign in failed.");
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!resendEmail.includes("@")) {
      setError("Please enter a valid email.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const supabase = getSupabaseClient();
      const { error: resendError } = await supabase.auth.resend({
        type: "signup",
        email: resendEmail,
      });

      if (resendError) {
        throw resendError;
      }

      setError("Verification email sent. Please check your inbox.");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not resend email.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-6 py-10">
      <main className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-6">
        <h1 className="text-xl font-semibold text-slate-900">Shelter Sign In</h1>
        <p className="mt-1 text-sm text-slate-600">Use your shelter account credentials.</p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Email</label>
            <input
              value={form.email}
              onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
              type="email"
              required
              className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Password</label>
            <input
              value={form.password}
              onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
              type="password"
              required
              className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm"
            />
          </div>

          {error ? <p className="text-sm text-rose-700">{error}</p> : null}

          <button
            disabled={loading}
            type="submit"
            className="h-10 w-full rounded-md bg-emerald-800 text-sm font-medium text-white disabled:opacity-50"
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <p className="mt-4 text-sm text-slate-600">
          No account?{" "}
          <button onClick={() => router.push("/shelter/register")} className="font-medium text-emerald-800">
            Create one
          </button>
        </p>

        <div className="mt-6 border-t border-slate-200 pt-4">
          <p className="mb-2 text-xs text-slate-500">Need another verification email?</p>
          <div className="flex gap-2">
            <input
              value={resendEmail}
              onChange={(e) => setResendEmail(e.target.value)}
              type="email"
              placeholder="email@example.org"
              className="h-9 flex-1 rounded-md border border-slate-300 px-2 text-sm"
            />
            <button onClick={handleResend} className="h-9 rounded-md border border-slate-300 px-3 text-sm">
              Resend
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
