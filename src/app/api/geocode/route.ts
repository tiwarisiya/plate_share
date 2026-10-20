import { NextRequest, NextResponse } from "next/server";

// Geocodes a US address without an API key: the US Census Bureau geocoder
// for the street address, then the ZIP code's centroid (Zippopotam.us) if
// the address doesn't match. Runs server-side because neither service
// allows browser (CORS) requests.

const CENSUS_URL = "https://geocoding.geo.census.gov/geocoder/locations/onelineaddress";
const ZIP_URL = "https://api.zippopotam.us/us/";
const TIMEOUT_MS = 8000;

type GeocodeResult = { latitude: number; longitude: number; source: "address" | "zip" };

async function fetchJson(url: string): Promise<unknown> {
  const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS), next: { revalidate: 86400 } });
  if (!res.ok) return null;
  return res.json();
}

async function geocodeAddress(oneLine: string): Promise<GeocodeResult | null> {
  const params = new URLSearchParams({ address: oneLine, benchmark: "Public_AR_Current", format: "json" });
  const body = (await fetchJson(`${CENSUS_URL}?${params}`)) as {
    result?: { addressMatches?: { coordinates: { x: number; y: number } }[] };
  } | null;
  const match = body?.result?.addressMatches?.[0];
  return match ? { latitude: match.coordinates.y, longitude: match.coordinates.x, source: "address" } : null;
}

async function geocodeZip(zip: string): Promise<GeocodeResult | null> {
  const body = (await fetchJson(`${ZIP_URL}${zip}`)) as { places?: { latitude: string; longitude: string }[] } | null;
  const place = body?.places?.[0];
  return place ? { latitude: Number(place.latitude), longitude: Number(place.longitude), source: "zip" } : null;
}

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams;
  const field = (name: string) => (q.get(name) || "").trim().slice(0, 200);
  const address = field("address");
  const city = field("city");
  const state = field("state");
  const zip = field("zip").replace(/[^0-9]/g, "").slice(0, 5);

  if (!address && zip.length !== 5) {
    return NextResponse.json({ error: "address or 5-digit zip required" }, { status: 400 });
  }

  try {
    const result =
      (address ? await geocodeAddress([address, city, state, zip].filter(Boolean).join(", ")) : null) ||
      (zip.length === 5 ? await geocodeZip(zip) : null);

    if (!result) return NextResponse.json({ error: "No match" }, { status: 404 });
    return NextResponse.json(result, { headers: { "Cache-Control": "public, max-age=86400" } });
  } catch {
    return NextResponse.json({ error: "Geocoding service unavailable" }, { status: 502 });
  }
}
