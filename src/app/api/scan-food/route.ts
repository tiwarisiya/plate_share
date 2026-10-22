import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getFoodScanProvider } from "@/lib/food-scan";
import { FoodScanResponse, FoodScanUnavailableError } from "@/lib/food-scan/types";

// Suggests form values from a food photo. Signed-in restaurants only; the
// browser resizes the photo first. Any failure returns an error and the
// form keeps working without suggestions.

const MAX_BYTES = 4 * 1024 * 1024;
const SCANS_PER_HOUR = 20;
const recentScans = new Map<string, number[]>();

function overLimit(userId: string): boolean {
  const hourAgo = Date.now() - 3600_000;
  const times = (recentScans.get(userId) || []).filter((t) => t > hourAgo);
  if (times.length >= SCANS_PER_HOUR) {
    recentScans.set(userId, times);
    return true;
  }
  recentScans.set(userId, [...times, Date.now()]);
  return false;
}

const unavailable = (message: string, status = 503) => NextResponse.json({ error: message, unavailable: true }, { status });

// Whether scanning is set up (never reveals the key).
export async function GET() {
  return NextResponse.json({ configured: getFoodScanProvider() !== null });
}

export async function POST(request: NextRequest) {
  const provider = getFoodScanProvider();
  if (!provider) return unavailable("Photo scanning isn't set up.");

  const token = request.headers.get("authorization")?.replace(/^Bearer /i, "");
  if (!token) return NextResponse.json({ error: "Sign in to scan photos." }, { status: 401 });

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: userData } = await supabase.auth.getUser(token);
  const user = userData.user;
  if (!user) return NextResponse.json({ error: "Sign in to scan photos." }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "restaurant") return NextResponse.json({ error: "Only restaurants can scan food photos." }, { status: 403 });

  if (overLimit(user.id)) return unavailable(`Scan limit reached (${SCANS_PER_HOUR} per hour). Fill in the form manually.`, 429);

  const form = await request.formData().catch(() => null);
  const file = form?.get("image");
  if (!(file instanceof Blob) || !file.type.startsWith("image/")) {
    return NextResponse.json({ error: "Attach an image." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "Image is too large." }, { status: 413 });

  try {
    const suggestions = await provider.scan({ data: new Uint8Array(await file.arrayBuffer()), mimeType: file.type });

    const { data: scan } = await supabase
      .from("food_scans")
      .insert({ restaurant_id: user.id, provider: provider.name, model: provider.model, suggestions })
      .select("id")
      .single();

    const body: FoodScanResponse = { scanId: scan?.id ?? null, suggestions };
    return NextResponse.json(body);
  } catch (err) {
    if (err instanceof FoodScanUnavailableError) {
      return unavailable("Photo scanning is busy or over its free quota. Fill in the form manually.");
    }
    console.error("[scan-food]", err instanceof Error ? err.message : err);
    return unavailable("Couldn't scan this photo. Fill in the form manually.", 502);
  }
}
