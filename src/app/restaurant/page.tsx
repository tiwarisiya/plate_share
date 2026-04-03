"use client";
import React from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";

export default function RestaurantEntry() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-slate-50">
      <main className="mx-auto grid min-h-screen max-w-6xl grid-cols-12 gap-6 px-6 py-10">
        <section className="col-span-12 rounded-lg border border-slate-200 bg-white p-8 lg:col-span-8">
          <div className="mb-6 flex items-center gap-3">
            <Image src="/logo.svg" alt="Plate Share logo" width={36} height={36} />
            <p className="text-sm font-semibold text-slate-800">Restaurant Workspace</p>
          </div>

          <h1 className="text-3xl font-bold text-slate-900">Manage incoming shelter demand and coordinate pickups</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-600">
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
                  <p className="text-sm font-medium text-slate-900">{item[0]}</p>
                  <p className="mt-2 text-xs text-slate-600">{item[1]}</p>
                </CardBody>
              </Card>
            ))}
          </div>
        </section>

        <section className="col-span-12 lg:col-span-4">
          <Card>
            <CardBody className="space-y-3">
              <p className="text-sm font-medium text-slate-900">Access</p>
              <Button className="w-full" onClick={() => router.push("/restaurant/login")}>Sign in</Button>
              <Button variant="secondary" className="w-full" onClick={() => router.push("/restaurant/register-donor")}>
                Create donor account
              </Button>
            </CardBody>
          </Card>
        </section>
      </main>
    </div>
  );
}
