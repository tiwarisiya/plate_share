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
  const [form, setForm] = useState({ identifier: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendEmail, setResendEmail] = useState("");

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

      // Check if identifier is email or phone
      const isEmail = form.identifier.includes("@");

      let authResult;
      if (isEmail) {
        // Sign in with email
        authResult = await supabase.auth.signInWithPassword({
          email: form.identifier,
          password: form.password,
        });
      } else {
        // For phone authentication, we'd need to implement SMS OTP
        // For now, we'll treat it as email (user should enter email)
        setError("Please enter your email address for login. Phone authentication coming soon.");
        setLoading(false);
        return;
      }

      if (authResult.error) {
        console.error("Auth error:", authResult.error);
        
        // Handle specific error cases
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
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-6 py-10">
      <main className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-6">
        <h1 className="text-xl font-semibold text-slate-900">Restaurant Sign In</h1>
        <p className="mt-1 text-sm text-slate-600">Use your restaurant account credentials.</p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Email or Phone</label>
            <input
              type="text"
              name="identifier"
              value={form.identifier}
              onChange={handleChange}
              required
              placeholder="example@restaurant.com or 555-555-5555"
              className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm"
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
          <button onClick={() => router.push("/restaurant/register-donor")} className="font-medium text-emerald-800">
            Create one
          </button>
        </p>

        <div className="mt-6 border-t border-slate-200 pt-4">
          <p className="mb-2 text-xs text-slate-500">Need another verification email?</p>
          <div className="flex gap-2">
            <input
              type="email"
              value={resendEmail}
              onChange={(e) => setResendEmail(e.target.value)}
              placeholder="email@example.org"
              className="h-9 flex-1 rounded-md border border-slate-300 px-2 text-sm"
            />
            <button
              onClick={handleResendConfirmation}
              disabled={loading}
              className="h-9 rounded-md border border-slate-300 px-3 text-sm disabled:opacity-50"
            >
              Resend
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
