"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabaseClient";
import { getCurrentUserRole, getDashboardPathForRole } from "@/lib/flow";

type DemoRole = "restaurant" | "shelter";

interface DemoButtonProps {
  role: DemoRole;
  className?: string;
}

export function DemoButton({ role, className = "" }: DemoButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const demoEmail =
    role === "restaurant"
      ? process.env.NEXT_PUBLIC_DEMO_RESTAURANT_EMAIL
      : process.env.NEXT_PUBLIC_DEMO_SHELTER_EMAIL;

  const demoPassword =
    role === "restaurant"
      ? process.env.NEXT_PUBLIC_DEMO_RESTAURANT_PASSWORD
      : process.env.NEXT_PUBLIC_DEMO_SHELTER_PASSWORD;

  // Hide button if demo credentials are not configured
  if (!demoEmail || !demoPassword) return null;

  const handleDemo = async () => {
    setLoading(true);
    setError(null);

    try {
      const supabase = getSupabaseClient();

      // Sign out any existing session first
      await supabase.auth.signOut();

      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: demoEmail,
        password: demoPassword,
      });

      if (signInError) {
        throw new Error(signInError.message);
      }

      if (!data.user) {
        throw new Error("Demo sign-in failed.");
      }

      const userRole = await getCurrentUserRole(data.user.id);
      if (userRole) {
        router.push(getDashboardPathForRole(userRole));
      } else {
        // Fallback — shouldn't happen with properly seeded demo accounts
        router.push(role === "restaurant" ? "/restaurant/home" : "/shelter/home");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Demo login failed.");
      setLoading(false);
    }
  };

  return (
    <div className="text-center">
      <button
        onClick={handleDemo}
        disabled={loading}
        className={`rounded-full border-2 border-dashed border-emerald-300 bg-emerald-50 px-5 py-2.5 text-sm font-medium text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-50 ${className}`}
      >
        {loading ? "Loading demo..." : `Try ${role === "restaurant" ? "Restaurant" : "Shelter"} Demo`}
      </button>
      {error ? <p className="mt-1 text-xs text-rose-600">{error}</p> : null}
    </div>
  );
}
