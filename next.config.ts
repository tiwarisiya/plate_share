import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  env: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
    NEXT_PUBLIC_DEMO_RESTAURANT_EMAIL: process.env.NEXT_PUBLIC_DEMO_RESTAURANT_EMAIL || "",
    NEXT_PUBLIC_DEMO_RESTAURANT_PASSWORD: process.env.NEXT_PUBLIC_DEMO_RESTAURANT_PASSWORD || "",
    NEXT_PUBLIC_DEMO_SHELTER_EMAIL: process.env.NEXT_PUBLIC_DEMO_SHELTER_EMAIL || "",
    NEXT_PUBLIC_DEMO_SHELTER_PASSWORD: process.env.NEXT_PUBLIC_DEMO_SHELTER_PASSWORD || "",
  },
};

export default nextConfig;
