"use client";
import Image from "next/image";
import { useRouter } from "next/navigation";
import React, { useState } from "react";
import { Button } from "./ui/button";
import { Card } from "./ui/card";

export default function SplashScreen() {
  const router = useRouter();
  const [selectedRole, setSelectedRole] = useState<"shelter" | "restaurant">("shelter");

  const handleGetStarted = () => {
    router.push(selectedRole === "restaurant" ? "/restaurant" : "/shelter");
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_#dcfce7_0%,_#f0fdfa_40%,_#f8fafc_72%)] px-4 py-4 sm:px-6 sm:py-8 lg:px-8">
      {/* Mobile layout */}
      <div className="lg:hidden">
        {/* Mobile top bar */}
        <header className="flex items-center justify-between px-1 pb-4">
          <div className="flex items-center gap-2">
            <span className="text-lg">🍽️</span>
            <span className="text-base font-bold text-slate-900">SharePlate</span>
          </div>
          <button className="text-sm text-slate-500">Skip</button>
        </header>

        {/* Hero image area */}
        <div className="relative mx-auto mb-4 h-44 w-full overflow-hidden rounded-2xl bg-emerald-50">
          <Image
            src="/PlateShare_Logo.png"
            alt="Plate Share"
            width={900}
            height={938}
            className="mx-auto h-full w-auto object-contain p-4"
            priority
          />
        </div>

        {/* Welcome text */}
        <div className="mb-5 text-center">
          <h1 className="text-2xl font-bold text-slate-900">Welcome to SharePlate</h1>
          <p className="mt-2 text-sm text-slate-600">
            Connect shelters with nearby restaurants to redistribute surplus food quickly and safely.
          </p>
        </div>

        {/* Role selector */}
        <div className="mb-5">
          <p className="mb-2 text-center text-sm text-slate-500">Choose your role</p>
          <p className="mb-2 text-center text-xs text-slate-400">I am a</p>
          <div className="flex gap-3">
            <button
              onClick={() => setSelectedRole("shelter")}
              className={`flex-1 rounded-full py-3 text-center text-sm font-semibold transition ${
                selectedRole === "shelter"
                  ? "bg-emerald-700 text-white shadow-md"
                  : "border border-slate-300 bg-white text-slate-700"
              }`}
            >
              🏠 Shelter
            </button>
            <button
              onClick={() => setSelectedRole("restaurant")}
              className={`flex-1 rounded-full py-3 text-center text-sm font-semibold transition ${
                selectedRole === "restaurant"
                  ? "bg-emerald-700 text-white shadow-md"
                  : "border border-slate-300 bg-white text-slate-700"
              }`}
            >
              🍳 Restaurant
            </button>
          </div>
        </div>

        {/* Key Features grid */}
        <div className="mb-6">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-900">Key features</p>
            <p className="text-xs text-slate-400">Swipe to explore</p>
          </div>
          <div className="grid grid-cols-4 gap-3">
            {[
              { icon: "📋", label: "Create\nRequests" },
              { icon: "✅", label: "Accept\nOffers" },
              { icon: "💬", label: "Chat" },
              { icon: "🔔", label: "Notifications" },
            ].map((feature) => (
              <div
                key={feature.label}
                className="flex flex-col items-center gap-1.5 rounded-xl border border-slate-200 bg-white p-3 text-center shadow-sm"
              >
                <span className="text-2xl">{feature.icon}</span>
                <span className="whitespace-pre-line text-[11px] leading-tight text-slate-700">{feature.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Get Started CTA */}
        <Button className="h-14 w-full rounded-full text-base font-semibold" onClick={handleGetStarted}>
          Get Started
        </Button>

        {/* Footer */}
        <p className="mt-4 text-center text-xs text-slate-400">
          Need help? Contact support
        </p>
      </div>

      {/* Desktop layout (unchanged) */}
      <main className="mx-auto hidden max-w-6xl lg:block">
        <Card className="overflow-hidden border-emerald-100 bg-white/95 shadow-lg shadow-emerald-100/40 backdrop-blur-sm">
          <div className="grid min-h-[680px] grid-cols-2">
            <section className="border-r border-emerald-100 bg-gradient-to-br from-white via-emerald-50/30 to-white p-10">
              <div className="flex flex-col items-start">
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

            <section className="flex items-center justify-center bg-gradient-to-b from-white to-emerald-50/30 p-10">
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
