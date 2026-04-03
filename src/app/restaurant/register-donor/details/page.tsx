"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabaseClient";
import {
  getCurrentUserRole,
  getDashboardPathForRole,
  getProfileDetailsPathForRole,
  isShelterProfileComplete,
} from "@/lib/flow";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field, Input, TextArea } from "@/components/ui/field";

type DetailsForm = {
  restaurantName: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  foodTypes: string;
  pickupWindow: string;
};

export default function RegisterDonorDetailsPage() {
  const router = useRouter();
  const [checkingSession, setCheckingSession] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [sessionUserId, setSessionUserId] = useState<string | null>(null);
  const [formData, setFormData] = useState<DetailsForm>({
    restaurantName: "",
    phone: "",
    address: "",
    city: "",
    state: "",
    zipCode: "",
    foodTypes: "",
    pickupWindow: "",
  });

  useEffect(() => {
    const validateSession = async () => {
      try {
        const supabase = getSupabaseClient();
        const { data, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;

        if (!data.session?.user) {
          router.replace("/restaurant/register-donor");
          return;
        }

        const existingRole = await getCurrentUserRole(data.session.user.id);
        if (existingRole && existingRole !== "restaurant") {
          const isComplete = await isShelterProfileComplete(data.session.user.id);
          router.replace(
            isComplete ? getDashboardPathForRole("shelter") : getProfileDetailsPathForRole("shelter")
          );
          return;
        }

        setSessionUserId(data.session.user.id);
        setEmail(data.session.user.email || "");
      } catch {
        router.replace("/restaurant/register-donor");
      } finally {
        setCheckingSession(false);
      }
    };

    void validateSession();
  }, [router]);

  const saveDonation = async () => {
    const supabase = getSupabaseClient();
    return supabase
      .from("donations")
      .insert([
        {
          restaurant_id: sessionUserId,
          restaurant_name: formData.restaurantName,
          address: formData.address,
          city: formData.city,
          state: formData.state,
          zip_code: formData.zipCode,
          food_type: formData.foodTypes,
          pickup_window: formData.pickupWindow,
          quantity: null,
        },
      ])
      .select();
  };

  const recoverSessionFromPendingSignup = async () => {
    if (typeof window === "undefined") return false;
    const pendingRaw = sessionStorage.getItem("pendingRestaurantSignup");
    if (!pendingRaw) return false;

    try {
      const pending = JSON.parse(pendingRaw) as { email?: string; password?: string };
      if (!pending.email || !pending.password) return false;

      const supabase = getSupabaseClient();
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: pending.email,
        password: pending.password,
      });

      if (signInError || !data.session) return false;
      if (!email && pending.email) setEmail(pending.email);
      return true;
    } catch {
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      if (!sessionUserId) throw new Error("Please sign in before finishing setup.");

      const supabase = getSupabaseClient();
      const { error: profileError } = await supabase.from("profiles").upsert(
        {
          id: sessionUserId,
          role: "restaurant",
          name: formData.restaurantName,
          phone: formData.phone,
          address: formData.address,
          city: formData.city,
          state: formData.state,
          zip_code: formData.zipCode,
          email,
        },
        { onConflict: "id" }
      );

      if (profileError) throw new Error(`Failed to save account info: ${profileError.message}`);

      let { data, error: insertError } = await saveDonation();
      if (insertError && insertError.message.toLowerCase().includes("row-level security")) {
        const recovered = await recoverSessionFromPendingSignup();
        if (recovered) {
          const retry = await saveDonation();
          data = retry.data;
          insertError = retry.error;
        }
      }

      if (insertError) throw new Error(`Failed to save donation details: ${insertError.message}`);
      if (!data || data.length === 0) throw new Error("No donation record returned.");

      if (typeof window !== "undefined") sessionStorage.removeItem("pendingRestaurantSignup");
      router.push(`/restaurant/success?id=${data[0].id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to complete setup.");
    } finally {
      setSubmitting(false);
    }
  };

  if (checkingSession) {
    return <div className="min-h-screen bg-slate-50 px-6 py-10 text-sm text-slate-600">Checking session...</div>;
  }

  return (
    <div className="min-h-screen bg-slate-50 px-6 py-10">
      <main className="mx-auto max-w-5xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">Restaurant Onboarding</h1>
          <p className="mt-1 text-sm text-slate-600">Step 2 of 2: complete your operation profile.</p>
        </div>

        <Card>
          <CardHeader>
            <p className="text-sm font-medium text-slate-900">Profile and Logistics</p>
          </CardHeader>
          <CardBody>
            <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <Field label="Verified email">
                  <Input value={email} disabled />
                </Field>
              </div>

              <div className="md:col-span-2">
                <Field label="Restaurant name">
                  <Input value={formData.restaurantName} onChange={(e) => setFormData((prev) => ({ ...prev, restaurantName: e.target.value }))} placeholder="Northside Kitchen" required />
                </Field>
              </div>

              <Field label="Phone">
                <Input value={formData.phone} onChange={(e) => setFormData((prev) => ({ ...prev, phone: e.target.value }))} placeholder="(555) 555-5555" required />
              </Field>

              <div className="md:col-span-2">
                <Field label="Address">
                  <Input value={formData.address} onChange={(e) => setFormData((prev) => ({ ...prev, address: e.target.value }))} placeholder="123 Main St" required />
                </Field>
              </div>

              <Field label="City">
                <Input value={formData.city} onChange={(e) => setFormData((prev) => ({ ...prev, city: e.target.value }))} placeholder="San Jose" required />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="State">
                  <Input maxLength={2} value={formData.state} onChange={(e) => setFormData((prev) => ({ ...prev, state: e.target.value }))} placeholder="CA" required />
                </Field>
                <Field label="ZIP">
                  <Input maxLength={5} value={formData.zipCode} onChange={(e) => setFormData((prev) => ({ ...prev, zipCode: e.target.value }))} placeholder="95112" required />
                </Field>
              </div>

              <Field label="Food types offered">
                <TextArea rows={4} value={formData.foodTypes} onChange={(e) => setFormData((prev) => ({ ...prev, foodTypes: e.target.value }))} placeholder="Prepared meals, salads, packaged items" required />
              </Field>

              <Field label="Preferred pickup window">
                <TextArea rows={4} value={formData.pickupWindow} onChange={(e) => setFormData((prev) => ({ ...prev, pickupWindow: e.target.value }))} placeholder="Mon-Fri 15:00 - 18:00" />
              </Field>

              {error ? <p className="md:col-span-2 text-sm text-rose-700">{error}</p> : null}

              <div className="md:col-span-2 flex items-center gap-3">
                <Button type="submit" disabled={submitting}>{submitting ? "Saving..." : "Finish setup"}</Button>
                <Button type="button" variant="secondary" onClick={() => router.push("/restaurant/register-donor")}>Cancel</Button>
              </div>
            </form>
          </CardBody>
        </Card>
      </main>
    </div>
  );
}
