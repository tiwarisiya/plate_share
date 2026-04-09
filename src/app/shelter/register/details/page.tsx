"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabaseClient";
import {
  getAuthenticatedUserDefaultRoute,
  getCurrentUserRole,
  getDashboardPathForRole,
  isShelterProfileComplete,
} from "@/lib/flow";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field, Input, TextArea } from "@/components/ui/field";

export default function ShelterRegisterDetailsPage() {
  const router = useRouter();
  const [checkingSession, setCheckingSession] = useState(true);
  const [sessionUserId, setSessionUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    shelterName: "",
    contactName: "",
    phone: "",
    email: "",
    address: "",
    city: "",
    state: "",
    zipCode: "",
    organizationNotes: "",
  });

  useEffect(() => {
    const validateSession = async () => {
      try {
        const supabase = getSupabaseClient();
        const { data, error: userError } = await supabase.auth.getUser();

        if (userError || !data.user || !data.user.email_confirmed_at) {
          router.replace("/shelter/register");
          return;
        }

        const existingRole = await getCurrentUserRole(data.user.id);
        if (existingRole && existingRole !== "shelter") {
          const routeForRole = await getAuthenticatedUserDefaultRoute(data.user.id, existingRole);
          router.replace(routeForRole);
          return;
        }

        if (existingRole === "shelter") {
          const complete = await isShelterProfileComplete(data.user.id);
          if (complete) {
            router.replace(getDashboardPathForRole("shelter"));
            return;
          }
        }

        if (!existingRole) {
          setSessionUserId(data.user.id);
          setFormData((prev) => ({ ...prev, email: data.user?.email || prev.email }));
          return;
        }

        setSessionUserId(data.user.id);
        setFormData((prev) => ({ ...prev, email: data.user?.email || prev.email }));
      } finally {
        setCheckingSession(false);
      }
    };

    void validateSession();
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!sessionUserId) {
      setError("Please sign in and verify your email first.");
      return;
    }

    setSaving(true);

    try {
      const supabase = getSupabaseClient();
      const { error: upsertError } = await supabase.from("profiles").upsert(
        {
          id: sessionUserId,
          role: "shelter",
          name: formData.shelterName,
          contact_name: formData.contactName,
          phone: formData.phone,
          email: formData.email,
          address: formData.address,
          city: formData.city,
          state: formData.state,
          zip_code: formData.zipCode,
          organization_notes: formData.organizationNotes || null,
        },
        { onConflict: "id" }
      );

      if (upsertError) {
        throw new Error(upsertError.message);
      }

      router.push("/shelter/home");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save account info.");
    } finally {
      setSaving(false);
    }
  };

  if (checkingSession) {
    return <div className="min-h-screen bg-slate-50 px-4 py-6 md:px-6 md:py-10 text-sm text-slate-600">Checking session...</div>;
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-6 md:px-6 md:py-10">
      <main className="mx-auto max-w-5xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">Shelter Onboarding</h1>
          <p className="mt-1 text-sm text-slate-600">Step 2 of 2: complete your shelter profile.</p>
        </div>

        <Card>
          <CardHeader>
            <p className="text-sm font-medium text-slate-900">Profile and Contact</p>
          </CardHeader>
          <CardBody>
            <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <Field label="Shelter name">
                  <Input value={formData.shelterName} onChange={(e) => setFormData((prev) => ({ ...prev, shelterName: e.target.value }))} placeholder="Hope Community Shelter" required />
                </Field>
              </div>

              <Field label="Contact name">
                <Input value={formData.contactName} onChange={(e) => setFormData((prev) => ({ ...prev, contactName: e.target.value }))} placeholder="Jordan Lee" required />
              </Field>
              <Field label="Phone">
                <Input value={formData.phone} onChange={(e) => setFormData((prev) => ({ ...prev, phone: e.target.value }))} placeholder="(555) 555-5555" required />
              </Field>

              <div className="md:col-span-2">
                <Field label="Verified email">
                  <Input type="email" value={formData.email} disabled />
                </Field>
              </div>

              <div className="md:col-span-2">
                <Field label="Address">
                  <Input value={formData.address} onChange={(e) => setFormData((prev) => ({ ...prev, address: e.target.value }))} placeholder="123 Main St" required />
                </Field>
              </div>

              <div className="md:col-span-2">
                <Field label="Organization notes (optional)">
                  <TextArea rows={3} value={formData.organizationNotes} onChange={(e) => setFormData((prev) => ({ ...prev, organizationNotes: e.target.value }))} placeholder="Program details, distribution constraints, special handling notes" />
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

              {error ? <p className="md:col-span-2 text-sm text-rose-700">{error}</p> : null}

              <div className="md:col-span-2 flex items-center gap-3">
                <Button type="submit" disabled={saving}>{saving ? "Saving..." : "Create account"}</Button>
                 <Button type="button" variant="secondary" onClick={() => router.push("/shelter/register")}>Cancel</Button>
              </div>
            </form>
          </CardBody>
        </Card>
      </main>
    </div>
  );
}
