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
    <div className="flex min-h-screen items-center justify-center bg-yellow-50 font-sans">
      <main className="w-full max-w-md px-6 py-24">
        <div className="bg-white ring-1 ring-emerald-100 rounded-2xl shadow-xl p-8">
          <h1 className="text-3xl font-semibold text-emerald-900 text-center mb-4">
            Restaurant Login
          </h1>
          <p className="text-sm text-emerald-700 text-center mb-8">
            Enter your email or phone number and password to access your account.
          </p>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-lg font-medium text-emerald-900 mb-2">
                Email or Phone
              </label>
              <input
                type="text"
                name="identifier"
                value={form.identifier}
                onChange={handleChange}
                required
                className="w-full px-4 py-3 border-2 border-emerald-200 rounded-lg focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 text-gray-700"
                placeholder="example@restaurant.com or 555-555-5555"
              />
            </div>

            <div>
              <label className="block text-lg font-medium text-emerald-900 mb-2">
                Password
              </label>
              <input
                type="password"
                name="password"
                value={form.password}
                onChange={handleChange}
                required
                className="w-full px-4 py-3 border-2 border-emerald-200 rounded-lg focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 text-gray-700"
                placeholder="••••••••"
              />
            </div>

            {/* Error Message */}
            {error && (
              <div className="p-4 bg-red-50 border-2 border-red-200 rounded-lg">
                <p className="text-red-700 font-medium">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-full bg-emerald-600 px-6 py-3 text-white font-semibold shadow-md hover:bg-emerald-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>

          <p className="text-sm text-emerald-700 text-center mt-6">
            Don't have an account?{' '}
            <button
              onClick={() => router.push('/restaurant/register-donor')}
              className="text-emerald-600 font-medium hover:underline"
            >
              Create one
            </button>
          </p>

          {/* Resend Confirmation Email */}
          <div className="mt-8 pt-6 border-t border-emerald-200">
            <p className="text-sm text-emerald-700 text-center mb-4">
              Didn't receive confirmation email?
            </p>
            <div className="flex gap-2">
              <input
                type="email"
                value={resendEmail}
                onChange={(e) => setResendEmail(e.target.value)}
                placeholder="Enter your email"
                className="flex-1 px-3 py-2 border-2 border-emerald-200 rounded-lg focus:outline-none focus:border-emerald-500 text-sm"
              />
              <button
                onClick={handleResendConfirmation}
                disabled={loading}
                className="px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition disabled:opacity-50"
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
