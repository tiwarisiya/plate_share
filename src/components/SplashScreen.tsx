"use client";
import Image from "next/image";
import { useRouter } from "next/navigation";
import React from "react";
import { Button } from "./ui/button";
import { Card, CardBody } from "./ui/card";

export default function SplashScreen() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <Image src="/logo.svg" alt="Plate Share logo" width={32} height={32} />
            <p className="text-sm font-semibold text-slate-900">Plate Share</p>
          </div>
          <p className="text-sm text-slate-500">Food Donation Operations Platform</p>
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl grid-cols-12 gap-6 px-6 py-10">
        <section className="col-span-12 rounded-lg border border-slate-200 bg-white p-8 lg:col-span-7">
          <p className="text-sm font-medium text-emerald-800">Distribution Command Center</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">Coordinate surplus meals across restaurants and shelters</h1>
          <p className="mt-3 max-w-2xl text-sm text-slate-600">
            Match supply and demand in real time, track accepted requests, and keep logistics communication centralized.
          </p>

          <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
            <Card>
              <CardBody>
                <p className="text-xs uppercase tracking-wide text-slate-500">Response Time</p>
                <p className="mt-2 text-2xl font-bold text-slate-900">18m</p>
                <p className="text-xs text-slate-500">Average request acceptance</p>
              </CardBody>
            </Card>
            <Card>
              <CardBody>
                <p className="text-xs uppercase tracking-wide text-slate-500">Active Partners</p>
                <p className="mt-2 text-2xl font-bold text-slate-900">126</p>
                <p className="text-xs text-slate-500">Restaurants and shelters online</p>
              </CardBody>
            </Card>
            <Card>
              <CardBody>
                <p className="text-xs uppercase tracking-wide text-slate-500">Meals Coordinated</p>
                <p className="mt-2 text-2xl font-bold text-slate-900">8.4k</p>
                <p className="text-xs text-slate-500">In the last 30 days</p>
              </CardBody>
            </Card>
          </div>
        </section>

        <section className="col-span-12 lg:col-span-5">
          <Card className="h-full">
            <CardBody className="space-y-3">
              <p className="text-sm font-medium text-slate-800">Choose your workspace</p>
              <p className="text-sm text-slate-600">Access the dashboard tailored to your operations role.</p>
              <Button className="w-full" onClick={() => router.push("/restaurant")}>Continue as Restaurant</Button>
              <Button variant="secondary" className="w-full" onClick={() => router.push("/shelter")}>Continue as Shelter</Button>
            </CardBody>
          </Card>
        </section>
      </main>
    </div>
  );
}
