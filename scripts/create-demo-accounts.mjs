// Creates fictional demo restaurants and shelters with fake email addresses,
// so demos don't show anyone's real email.
//
// Accounts are created already confirmed through the Supabase admin API, so
// no confirmation email is sent and the "Confirm email" auth setting can stay
// on for real users. Safe to re-run: existing demo accounts are updated, not
// duplicated.
//
// Needs (e.g. in .env.local, never committed):
//   NEXT_PUBLIC_SUPABASE_URL      your project URL
//   SUPABASE_SERVICE_ROLE_KEY     Project Settings > API > service_role (secret)
//   DEMO_ACCOUNT_PASSWORD         password for every demo account (8+ chars)
//
// Run:  node --env-file=.env.local scripts/create-demo-accounts.mjs
//
// All demo emails end in @plateshare-demo.test (a reserved domain that can't
// receive mail), and each profile's notes say it's a demo account.

import { createClient } from "@supabase/supabase-js";

const DEMO_DOMAIN = "plateshare-demo.test";
const DEMO_NOTE = "Demo account (fictional organization) for PlateShare demos.";

const RESTAURANTS = [
  {
    slug: "golden-gate-grill",
    name: "Golden Gate Grill",
    contact_name: "Maya Chen",
    phone: "(510) 555-0141",
    address: "2470 Telegraph Ave",
    city: "Berkeley",
    zip_code: "94704",
    cuisine: "American comfort food: sandwiches, roasted vegetables, soups",
    default_pickup_window: "Daily 3:00 PM - 6:00 PM",
  },
  {
    slug: "saffron-table",
    name: "Saffron Table",
    contact_name: "Arjun Rao",
    phone: "(510) 555-0142",
    address: "1500 Shattuck Ave",
    city: "Berkeley",
    zip_code: "94709",
    cuisine: "Indian curries, rice, lentils, naan",
    default_pickup_window: "Tue-Sun 2:30 PM - 5:00 PM",
  },
  {
    slug: "harbor-noodle-house",
    name: "Harbor Noodle House",
    contact_name: "Lena Park",
    phone: "(510) 555-0143",
    address: "3800 Piedmont Ave",
    city: "Oakland",
    zip_code: "94611",
    cuisine: "Noodles, dumplings, stir-fried vegetables",
    default_pickup_window: "Mon-Sat 4:00 PM - 7:00 PM",
  },
];

const SHELTERS = [
  {
    slug: "northside-family-shelter",
    name: "Northside Family Shelter",
    contact_name: "Jordan Lee",
    phone: "(510) 555-0151",
    address: "2140 Dwight Way",
    city: "Berkeley",
    zip_code: "94704",
  },
  {
    slug: "eastbay-hope-center",
    name: "Eastbay Hope Center",
    contact_name: "Priya Natarajan",
    phone: "(510) 555-0152",
    address: "1300 San Pablo Ave",
    city: "Berkeley",
    zip_code: "94702",
  },
  {
    slug: "lakeview-community-kitchen",
    name: "Lakeview Community Kitchen",
    contact_name: "Sam Ortiz",
    phone: "(510) 555-0153",
    address: "3200 Grand Ave",
    city: "Oakland",
    zip_code: "94610",
  },
];

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing ${name}. See the comment at the top of this script.`);
    process.exit(1);
  }
  return value;
}

// Same lookup as /api/geocode: street address via the US Census geocoder,
// falling back to the ZIP centroid.
async function geocode({ address, city, zip_code }) {
  try {
    const params = new URLSearchParams({ address: `${address}, ${city}, CA ${zip_code}`, benchmark: "Public_AR_Current", format: "json" });
    const res = await fetch(`https://geocoding.geo.census.gov/geocoder/locations/onelineaddress?${params}`);
    const match = (await res.json())?.result?.addressMatches?.[0];
    if (match) return { latitude: match.coordinates.y, longitude: match.coordinates.x, geocode_source: "address" };
  } catch {
    // fall through to ZIP
  }
  try {
    const res = await fetch(`https://api.zippopotam.us/us/${zip_code}`);
    const place = (await res.json())?.places?.[0];
    if (place) return { latitude: Number(place.latitude), longitude: Number(place.longitude), geocode_source: "zip" };
  } catch {
    // no coordinates
  }
  return { latitude: null, longitude: null, geocode_source: null };
}

async function findUserByEmail(admin, email) {
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const user = data.users.find((u) => u.email === email);
    if (user || data.users.length < 200) return user || null;
  }
  return null;
}

async function main() {
  const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  const password = requireEnv("DEMO_ACCOUNT_PASSWORD");
  if (password.length < 8) {
    console.error("DEMO_ACCOUNT_PASSWORD must be at least 8 characters.");
    process.exit(1);
  }

  const supabase = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const admin = supabase.auth.admin;

  const accounts = [
    ...RESTAURANTS.map((r) => ({ ...r, role: "restaurant" })),
    ...SHELTERS.map((s) => ({ ...s, role: "shelter" })),
  ];

  const results = [];
  for (const account of accounts) {
    const email = `${account.slug}@${DEMO_DOMAIN}`;
    let user = await findUserByEmail(admin, email);

    if (user) {
      const { error } = await admin.updateUserById(user.id, { password, email_confirm: true, user_metadata: { demo: true } });
      if (error) throw new Error(`${email}: ${error.message}`);
    } else {
      const { data, error } = await admin.createUser({ email, password, email_confirm: true, user_metadata: { demo: true } });
      if (error) throw new Error(`${email}: ${error.message}`);
      user = data.user;
    }

    const location = await geocode(account);
    const profile = {
      id: user.id,
      role: account.role,
      name: account.name,
      contact_name: account.contact_name,
      phone: account.phone,
      address: account.address,
      city: account.city,
      state: "CA",
      zip_code: account.zip_code,
      organization_notes: DEMO_NOTE,
      ...location,
      ...(account.role === "restaurant"
        ? { cuisine: account.cuisine, default_pickup_window: account.default_pickup_window }
        : {}),
    };

    const { error: profileError } = await supabase.from("profiles").upsert(profile, { onConflict: "id" });
    if (profileError) throw new Error(`${email} profile: ${profileError.message}`);

    // profiles.email is filled from the login email by a database trigger.
    const { data: saved } = await supabase.from("profiles").select("email").eq("id", user.id).single();
    results.push({ role: account.role, name: account.name, email, profileEmail: saved?.email === email ? "ok" : `MISMATCH (${saved?.email})`, located: location.geocode_source || "no" });
  }

  console.table(results);
  console.log(`Done. Sign in with any email above and DEMO_ACCOUNT_PASSWORD.`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
