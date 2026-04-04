"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/field";

type FormData = {
  email: string;
  password: string;
  confirmPassword: string;
};

export default function RegisterDonor() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [formData, setFormData] = useState<FormData>({ email: "", password: "", confirmPassword: "" });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const pendingRaw = sessionStorage.getItem("pendingRestaurantSignup");
    if (!pendingRaw) return;

    try {
      const pending = JSON.parse(pendingRaw) as { email?: string; password?: string };
      if (pending.email && pending.password) {
        setFormData({ email: pending.email, password: pending.password, confirmPassword: pending.password });
        setAwaitingConfirmation(true);
      }
    } catch {
      sessionStorage.removeItem("pendingRestaurantSignup");
    }
  }, []);

  const getEmailRedirectTo = () => {
    if (typeof window === "undefined") return undefined;
    return `${window.location.origin}/restaurant/login`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setInfo(null);

    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match.");
      setLoading(false);
      return;
    }

    try {
      const supabase = getSupabaseClient();
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: { emailRedirectTo: getEmailRedirectTo() },
      });

      if (authError) {
        const duplicateUser = authError.message.toLowerCase().includes("already registered");
        if (!duplicateUser) {
          throw new Error(`Account creation failed: ${authError.message}`);
        }
        setInfo("Account already exists. Confirm your email and continue.");
      }

      if (typeof window !== "undefined") {
        sessionStorage.setItem(
          "pendingRestaurantSignup",
          JSON.stringify({ email: formData.email, password: formData.password })
        );
      }

      if (authData.session) {
        if (typeof window !== "undefined") {
          sessionStorage.removeItem("pendingRestaurantSignup");
        }
        router.push("/restaurant/register-donor/details");
      } else {
        setAwaitingConfirmation(true);
        setInfo("Check your inbox for a verification email, then continue.");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create account.");
    } finally {
      setLoading(false);
    }
  };

  const handleContinueAfterVerification = async () => {
    setVerifying(true);
    setError(null);

    try {
      const supabase = getSupabaseClient();
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: formData.email,
        password: formData.password,
      });

      if (signInError) {
        throw new Error(signInError.message.includes("Email not confirmed") ? "Email not confirmed yet." : signInError.message);
      }

      if (!data.session) {
        throw new Error("No active session found.");
      }

      if (typeof window !== "undefined") {
        sessionStorage.removeItem("pendingRestaurantSignup");
      }

      router.push("/restaurant/register-donor/details");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Verification failed.");
    } finally {
      setVerifying(false);
    }
  };

  const handleResend = async () => {
    setError(null);
    setInfo(null);

    try {
      const supabase = getSupabaseClient();
      const { error: resendError } = await supabase.auth.resend({
        type: "signup",
        email: formData.email,
        options: { emailRedirectTo: getEmailRedirectTo() },
      });

      if (resendError) {
        throw new Error(resendError.message);
      }

      setInfo("Verification email sent.");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not resend verification email.");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 px-6 py-10">
      <main className="mx-auto max-w-4xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">Restaurant Onboarding</h1>
          <p className="mt-1 text-sm text-slate-600">Step 1 of 2: set your credentials and verify your email.</p>
        </div>

        <Card>
          <CardHeader>
            <p className="text-sm font-medium text-slate-900">Account Access</p>
          </CardHeader>
          <CardBody>
            <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <Field label="Email">
                  <Input type="email" value={formData.email} onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))} placeholder="ops@restaurant.com" required />
                </Field>
              </div>

              <Field label="Password">
                <Input type="password" value={formData.password} minLength={6} onChange={(e) => setFormData((prev) => ({ ...prev, password: e.target.value }))} placeholder="At least 6 characters" required />
              </Field>

              <Field label="Confirm password">
                <Input type="password" value={formData.confirmPassword} minLength={6} onChange={(e) => setFormData((prev) => ({ ...prev, confirmPassword: e.target.value }))} placeholder="Repeat password" required />
              </Field>

              {error ? <p className="md:col-span-2 text-sm text-rose-700">{error}</p> : null}
              {info ? <p className="md:col-span-2 text-sm text-blue-700">{info}</p> : null}

              <div className="md:col-span-2 flex flex-wrap gap-3">
                <Button type="submit" disabled={loading}>{loading ? "Creating..." : "Create account"}</Button>
                {awaitingConfirmation ? (
                  <>
                    <Button type="button" variant="secondary" onClick={handleContinueAfterVerification} disabled={verifying}>
                      {verifying ? "Verifying..." : "Continue after verification"}
                    </Button>
                    <Button type="button" variant="ghost" onClick={handleResend}>Resend email</Button>
                  </>
                ) : null}
              </div>
            </form>
          </CardBody>
        </Card>
      </main>
    </div>
  );
}
