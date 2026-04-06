"use client";
import Image from "next/image";
import { useRouter } from "next/navigation";
import React from "react";
import { Button } from "./ui/button";
import { Card } from "./ui/card";

export default function SplashScreen() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_#dcfce7_0%,_#f0fdfa_40%,_#f8fafc_72%)] px-4 py-8 sm:px-6 lg:px-8">
      <main className="mx-auto max-w-6xl">
        <Card className="overflow-hidden border-emerald-100 bg-white/95 shadow-lg shadow-emerald-100/40 backdrop-blur-sm">
          <div className="grid min-h-[680px] grid-cols-1 lg:grid-cols-2">
            <section className="border-b border-emerald-100 bg-gradient-to-br from-white via-emerald-50/30 to-white p-8 sm:p-10 lg:border-b-0 lg:border-r">
              <div className="flex flex-col items-center lg:items-start">
                <Image src="/PlateShare_Logo.png" alt="Plate Share logo" width={900} height={938} className="h-64 w-auto" priority />

                <div className="mt-8 w-full space-y-4">
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4">
                    <p className="text-lg font-semibold text-slate-800">Match live donation requests quickly</p>
                  </div>
                  <div className="rounded-xl border border-cyan-200 bg-cyan-50/70 p-4">
                    <p className="text-lg font-semibold text-slate-800">Coordinate pickups in one place</p>
                  </div>
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4">
                    <p className="text-lg font-semibold text-slate-800">Track every request end to end</p>
                  </div>
                </div>
              </div>
            </section>

            <section className="flex items-center justify-center bg-gradient-to-b from-white to-emerald-50/30 p-6 sm:p-10">
              <div className="w-full max-w-md space-y-4">
                <Button className="h-14 w-full text-lg" onClick={() => router.push("/restaurant")}>Continue as Restaurant</Button>
                <Button variant="secondary" className="h-14 w-full text-lg" onClick={() => router.push("/shelter")}>Continue as Shelter</Button>
              </div>
            </section>
          </div>
        </Card>
      </main>
    </div>
  );
}
