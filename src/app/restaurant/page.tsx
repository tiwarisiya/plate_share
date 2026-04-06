"use client";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { getSupabaseClient } from "@/lib/supabaseClient";
import { getAuthenticatedUserDefaultRoute } from "@/lib/flow";

export default function RestaurantEntry() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const redirectIfAuthenticated = async () => {
      const supabase = getSupabaseClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user && user.email_confirmed_at) {
        const destination = await getAuthenticatedUserDefaultRoute(user.id, "restaurant");
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
      <main className="mx-auto grid min-h-screen max-w-6xl grid-cols-12 gap-6 px-6 py-10">
        <section className="col-span-12 rounded-lg border border-slate-200 bg-white p-8 lg:col-span-8">
          <div className="mb-6 flex items-center gap-3">
            <Image src="/PlateShare_Logo.png" alt="Plate Share logo" width={154} height={160} className="h-16 w-auto" />
            <p className="text-lg font-semibold text-slate-800">Restaurant Workspace</p>
          </div>

          <h1 className="text-3xl font-bold text-slate-900">Manage incoming shelter demand and coordinate pickups</h1>
          <p className="mt-2 max-w-2xl text-lg text-slate-600">
            Review requests, accept donation opportunities, and keep communication centralized with shelters.
          </p>

          <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
            {[
              ["Open Requests", "Live feed of needs by location"],
              ["Match Tracking", "Follow confirmed pickups"],
              ["Operations Log", "Notification timeline and status"],
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

        <section className="col-span-12 lg:col-span-4">
          <Card>
            <CardBody className="space-y-3">
              <p className="text-lg font-medium text-slate-900">Access</p>
              <Button className="w-full text-lg" onClick={() => router.push("/restaurant/login")}>Sign in</Button>
              <Button variant="secondary" className="w-full text-lg" onClick={() => router.push("/restaurant/register-donor")}>
                Create donor account
              </Button>
            </CardBody>
          </Card>
        </section>
      </main>
    </div>
  );
}
