"use client";
import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabaseClient";
import {
  getCurrentUserRole,
  getDashboardPathForRole,
  getProfileDetailsPathForRole,
  isRestaurantProfileComplete,
  isShelterProfileComplete,
} from "@/lib/flow";

export default function RestaurantLogin() {
  const router = useRouter();
  const [authTab, setAuthTab] = useState<"signin" | "signup">("signin");
  const [form, setForm] = useState({ identifier: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendEmail, setResendEmail] = useState("");
  const [rememberMe, setRememberMe] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleResendConfirmation = async () => {
    if (!resendEmail.includes("@")) {
      setError("Please enter a valid email address");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: resendEmail,
      });

      if (error) throw error;

      setError("Confirmation email sent! Please check your inbox.");
    } catch (err: any) {
      setError("Failed to resend confirmation email: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const supabase = getSupabaseClient();

      const isEmail = form.identifier.includes("@");

      let authResult;
      if (isEmail) {
        authResult = await supabase.auth.signInWithPassword({
          email: form.identifier,
          password: form.password,
        });
      } else {
        setError("Please enter your email address for login. Phone authentication coming soon.");
        setLoading(false);
        return;
      }

      if (authResult.error) {
        console.error("Auth error:", authResult.error);

        if (authResult.error.message.includes("Email not confirmed")) {
          setError("Please check your email and click the confirmation link before signing in.");
        } else if (authResult.error.message.includes("Invalid login credentials")) {
          setError("Invalid email or password. Please check your credentials.");
        } else {
          throw new Error(authResult.error.message);
        }

        setLoading(false);
        return;
      }

      if (authResult.data.user) {
        const role = await getCurrentUserRole(authResult.data.user.id);

        if (!role) {
          router.push("/restaurant/register-donor/details");
          return;
        }

        const isComplete =
          role === "restaurant"
            ? await isRestaurantProfileComplete(authResult.data.user.id)
            : await isShelterProfileComplete(authResult.data.user.id);

        if (!isComplete) {
          router.push(getProfileDetailsPathForRole(role));
          return;
        }

        router.push(getDashboardPathForRole(role));
      }
    } catch (err: any) {
      console.error("Login error:", err);
      setError(err.message || "Failed to login. Please check your credentials.");
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-6 md:px-6 md:py-10">
      <main className="w-full max-w-md">
        {/* Mobile header */}
        <div className="mb-6 md:hidden">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
            <span className="text-3xl">🍽️</span>
          </div>
          <p className="text-center text-sm text-slate-600">Welcome back — choose how you&apos;d like to sign up</p>
        </div>

        {/* Auth tab toggle - mobile only */}
        <div className="mb-4 flex overflow-hidden rounded-full border border-slate-200 bg-slate-100 p-1 md:hidden">
          <button
            onClick={() => setAuthTab("signin")}
            className={`flex-1 rounded-full py-2.5 text-center text-sm font-medium transition ${
              authTab === "signin"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500"
            }`}
          >
            Sign In
          </button>
          <button
            onClick={() => { setAuthTab("signup"); router.push("/restaurant/register-donor"); }}
            className={`flex-1 rounded-full py-2.5 text-center text-sm font-medium transition ${
              authTab === "signup"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500"
            }`}
          >
            Sign Up
          </button>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 md:rounded-lg md:p-6">
          {/* Desktop header */}
          <div className="hidden md:block">
            <h1 className="text-xl font-semibold text-slate-900">Restaurant Sign In</h1>
            <p className="mt-1 text-sm text-slate-600">Use your restaurant account credentials.</p>
          </div>

          <form onSubmit={handleSubmit} className="mt-4 space-y-4 md:mt-6">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Email</label>
              <input
                type="email"
                name="identifier"
                value={form.identifier}
                onChange={handleChange}
                required
                placeholder="example@restaurant.com"
                className="h-12 w-full rounded-xl border border-slate-300 px-4 text-sm md:h-10 md:rounded-md md:px-3"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Password</label>
              <input
                type="password"
                name="password"
                value={form.password}
                onChange={handleChange}
                required
                className="h-12 w-full rounded-xl border border-slate-300 px-4 text-sm md:h-10 md:rounded-md md:px-3"
              />
            </div>

            {/* Remember me toggle - mobile */}
            <div className="flex items-center justify-between md:hidden">
              <label className="flex items-center gap-2 text-sm text-slate-600">
                <div
                  onClick={() => setRememberMe(!rememberMe)}
                  className={`relative h-6 w-11 cursor-pointer rounded-full transition ${rememberMe ? "bg-emerald-600" : "bg-slate-300"}`}
                >
                  <div className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition ${rememberMe ? "left-[22px]" : "left-0.5"}`} />
                </div>
                Remember me
              </label>
            </div>

            {error ? <p className="text-sm text-rose-700">{error}</p> : null}

            <button
              disabled={loading}
              type="submit"
              className="h-12 w-full rounded-xl bg-emerald-800 text-sm font-semibold text-white disabled:opacity-50 md:h-10 md:rounded-md"
            >
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>


          {/* Create account link */}
          <p className="mt-4 text-center text-sm text-slate-600 md:text-left">
            No account?{" "}
            <button onClick={() => router.push("/restaurant/register-donor")} className="font-medium text-emerald-800">
              Create one
            </button>
          </p>

          {/* Resend verification */}
          <div className="mt-5 border-t border-slate-200 pt-4">
            <p className="mb-2 text-xs text-slate-500">Need another verification email?</p>
            <div className="flex gap-2">
              <input
                type="email"
                value={resendEmail}
                onChange={(e) => setResendEmail(e.target.value)}
                placeholder="email@example.org"
                className="h-10 flex-1 rounded-xl border border-slate-300 px-3 text-sm md:h-9 md:rounded-md md:px-2"
              />
              <button
                onClick={handleResendConfirmation}
                disabled={loading}
                className="h-10 rounded-xl border border-slate-300 px-4 text-sm disabled:opacity-50 md:h-9 md:rounded-md md:px-3"
              >
                Resend
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
