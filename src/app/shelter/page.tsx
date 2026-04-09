"use client";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { getSupabaseClient } from "@/lib/supabaseClient";
import { getAuthenticatedUserDefaultRoute } from "@/lib/flow";

export default function ShelterEntry() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const redirectIfAuthenticated = async () => {
      const supabase = getSupabaseClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user && user.email_confirmed_at) {
        const destination = await getAuthenticatedUserDefaultRoute(user.id, "shelter");
        router.replace(destination);
        return;
      }

      setChecking(false);
    };

    void redirectIfAuthenticated();
  }, [router]);

  if (checking) {
    return <div className="min-h-screen bg-slate-50 px-6 py-10 text-lg text-slate-600">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <main className="mx-auto grid min-h-screen max-w-6xl grid-cols-1 gap-6 px-4 py-6 md:grid-cols-12 md:px-6 md:py-10">
        <section className="col-span-1 rounded-lg border border-slate-200 bg-white p-5 md:col-span-8 md:p-8">
          <div className="mb-6 flex items-center gap-3">
            <Image src="/PlateShare_Logo.png" alt="Plate Share logo" width={154} height={160} className="h-16 w-auto" />
            <p className="text-lg font-semibold text-slate-800">Shelter Workspace</p>
          </div>

          <h1 className="text-3xl font-bold text-slate-900">Post food needs and coordinate with nearby restaurants</h1>
          <p className="mt-2 max-w-2xl text-lg text-slate-600">
            Submit requests, monitor fulfillment status, and communicate with matched restaurant partners.
          </p>

          <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
            {[
              ["Request Intake", "Structured request submission"],
              ["Status Tracking", "Monitor open and matched requests"],
              ["Partner Chat", "Coordinate timing and logistics"],
            ].map((item) => (
              <Card key={item[0]}>
                <CardBody>
                  <p className="text-lg font-medium text-slate-900">{item[0]}</p>
                  <p className="mt-2 text-lg text-slate-600">{item[1]}</p>
                </CardBody>
              </Card>
            ))}
          </div>
        </section>

        <section className="col-span-1 md:col-span-4">
          <Card>
            <CardBody className="space-y-3">
              <p className="text-lg font-medium text-slate-900">Access</p>
              <Button variant="secondary" className="w-full text-lg" onClick={() => router.push("/shelter/login")}>Sign in</Button>
              <Button className="w-full text-lg" onClick={() => router.push("/shelter/register")}>Create shelter account</Button>
            </CardBody>
          </Card>
        </section>
      </main>
    </div>
  );
}
