"use client";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { getSupabaseClient } from "@/lib/supabaseClient";
import { getAuthenticatedUserDefaultRoute } from "@/lib/flow";
import { DemoButton } from "@/components/ui/demo-button";

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
      {/* Mobile layout */}
      <div className="flex min-h-screen flex-col items-center justify-center px-5 py-8 md:hidden">
        <Image src="/PlateShare_Logo.png" alt="PlateShare logo" width={154} height={160} className="mb-4 h-20 w-auto" />
        <h1 className="mb-1 text-xl font-bold text-slate-900">Shelter Workspace</h1>
        <p className="mb-8 text-center text-sm text-slate-600">
          Post food needs and coordinate with nearby restaurants.
        </p>
        <div className="w-full max-w-xs space-y-3">
          <Button className="h-12 w-full rounded-xl text-sm font-semibold" onClick={() => router.push("/shelter/login")}>Sign In</Button>
          <Button variant="secondary" className="h-12 w-full rounded-xl text-sm font-semibold" onClick={() => router.push("/shelter/register")}>
            Create Shelter Account
          </Button>
          <DemoButton role="shelter" className="w-full" />
        </div>
      </div>

      {/* Desktop layout */}
      <main className="mx-auto hidden min-h-screen max-w-6xl grid-cols-12 gap-6 px-6 py-10 md:grid">
        <section className="col-span-8 rounded-lg border border-slate-200 bg-white p-8">
          <div className="mb-6 flex items-center gap-3">
            <Image src="/PlateShare_Logo.png" alt="PlateShare logo" width={154} height={160} className="h-16 w-auto" />
            <p className="text-lg font-semibold text-slate-800">Shelter Workspace</p>
          </div>

          <h1 className="text-3xl font-bold text-slate-900">Post food needs and coordinate with nearby restaurants</h1>
          <p className="mt-2 max-w-2xl text-lg text-slate-600">
            Submit requests, monitor fulfillment status, and communicate with matched restaurant partners.
          </p>

          <div className="mt-8 grid grid-cols-3 gap-4">
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

        <section className="col-span-4">
          <Card>
            <CardBody className="space-y-3">
              <p className="text-lg font-medium text-slate-900">Access</p>
              <Button variant="secondary" className="w-full text-lg" onClick={() => router.push("/shelter/login")}>Sign in</Button>
              <Button className="w-full text-lg" onClick={() => router.push("/shelter/register")}>Create shelter account</Button>
              <DemoButton role="shelter" className="w-full" />
            </CardBody>
          </Card>
        </section>
      </main>
    </div>
  );
}
