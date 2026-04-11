import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const DEMO_RESTAURANT_EMAIL = 'demo.restaurant@plateshare.app';
const DEMO_RESTAURANT_PASSWORD = 'demo1234';
const DEMO_SHELTER_EMAIL = 'demo.shelter@plateshare.app';
const DEMO_SHELTER_PASSWORD = 'demo1234';

async function setupDemoAccount(role, email, password) {
  console.log(`\n--- ${role.toUpperCase()} ---`);

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Try sign in first (account may already exist)
  let user = null;
  const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({ email, password });

  if (!signInError && signInData.user) {
    user = signInData.user;
    console.log(`  Signed in existing account: ${user.id}`);
  } else {
    // Sign up new account
    console.log(`  Creating new account...`);
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({ email, password });

    if (signUpError) {
      console.error(`  Sign up failed: ${signUpError.message}`);
      return false;
    }

    user = signUpData.user;
    if (!user) {
      console.error(`  No user returned`);
      return false;
    }

    console.log(`  Account created: ${user.id}`);

    // Sign in to get an authenticated session
    const { data: freshSignIn, error: freshError } = await supabase.auth.signInWithPassword({ email, password });
    if (freshError) {
      console.error(`  Post-signup sign in failed: ${freshError.message}`);
      return false;
    }
    user = freshSignIn.user;
    console.log(`  Signed in: ${user.id}`);
  }

  // Create profile
  const profileData = role === 'restaurant'
    ? {
        id: user.id,
        role: 'restaurant',
        name: 'Demo Restaurant',
        email,
        phone: '(555) 100-2000',
        address: '123 Main Street',
        city: 'San Francisco',
        state: 'CA',
        zip_code: '94105',
      }
    : {
        id: user.id,
        role: 'shelter',
        name: 'Demo Shelter',
        email,
        phone: '(555) 200-3000',
        address: '456 Oak Avenue',
        city: 'San Francisco',
        state: 'CA',
        zip_code: '94110',
      };

  const { error: profileError } = await supabase.from('profiles').upsert(profileData, { onConflict: 'id' });
  if (profileError) {
    console.error(`  Profile failed: ${profileError.message}`);
    return false;
  }
  console.log(`  Profile: ${profileData.name} ✓`);

  // Restaurant needs a donation entry for complete profile
  if (role === 'restaurant') {
    const { error: donationError } = await supabase.from('donations').insert({
      restaurant_id: user.id,
      food_type: 'Prepared meals, sandwiches, fresh produce',
      quantity: 50,
      pickup_window: 'Mon-Fri 2:00 PM - 5:00 PM',
      status: 'posted',
    });

    if (donationError && !donationError.message.includes('duplicate')) {
      console.error(`  Donation failed: ${donationError.message}`);
    } else {
      console.log(`  Donation profile ✓`);
    }
  }

  return true;
}

async function main() {
  console.log('=== PlateShare Demo Account Setup ===');

  const r = await setupDemoAccount('restaurant', DEMO_RESTAURANT_EMAIL, DEMO_RESTAURANT_PASSWORD);
  const s = await setupDemoAccount('shelter', DEMO_SHELTER_EMAIL, DEMO_SHELTER_PASSWORD);

  console.log('\n=== Results ===');
  console.log(`Restaurant: ${r ? '✓' : '✗'}`);
  console.log(`Shelter:    ${s ? '✓' : '✗'}`);

  if (r && s) {
    console.log('\n=== Add to .env.local and Replit Secrets ===');
    console.log(`NEXT_PUBLIC_DEMO_RESTAURANT_EMAIL=${DEMO_RESTAURANT_EMAIL}`);
    console.log(`NEXT_PUBLIC_DEMO_RESTAURANT_PASSWORD=${DEMO_RESTAURANT_PASSWORD}`);
    console.log(`NEXT_PUBLIC_DEMO_SHELTER_EMAIL=${DEMO_SHELTER_EMAIL}`);
    console.log(`NEXT_PUBLIC_DEMO_SHELTER_PASSWORD=${DEMO_SHELTER_PASSWORD}`);
  }
}

main().catch(console.error);
