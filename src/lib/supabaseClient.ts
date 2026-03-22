import { createClient } from "@supabase/supabase-js";

let supabaseInstance: any = null;

export function getSupabaseClient() {
  if (supabaseInstance) {
    return supabaseInstance;
  }

  console.log("SUPABASE URL:", process.env.NEXT_PUBLIC_SUPABASE_URL);

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error(
      "Missing Supabase credentials. Check NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local"
    );
  }

  // Validate URL format
  try {
    new URL(url);
  } catch (e) {
    throw new Error(`Invalid Supabase URL format: ${url}`);
  }

  supabaseInstance = createClient(url, key);
  return supabaseInstance;
}
