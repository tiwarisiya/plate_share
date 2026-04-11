import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const RESTAURANT_EMAIL = 'demo.restaurant@plateshare.app';
const RESTAURANT_PASSWORD = 'demo1234';
const SHELTER_EMAIL = 'demo.shelter@plateshare.app';
const SHELTER_PASSWORD = 'demo1234';

async function main() {
  console.log('=== Seeding Demo Data for Berkeley ===\n');

  // --- Sign in as Restaurant ---
  const rClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: rAuth } = await rClient.auth.signInWithPassword({ email: RESTAURANT_EMAIL, password: RESTAURANT_PASSWORD });
  const restaurantId = rAuth.user.id;
  console.log('Restaurant:', restaurantId);

  // --- Sign in as Shelter ---
  const sClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: sAuth } = await sClient.auth.signInWithPassword({ email: SHELTER_EMAIL, password: SHELTER_PASSWORD });
  const shelterId = sAuth.user.id;
  console.log('Shelter:', shelterId);

  // --- Update Restaurant profile ---
  const { error: rProfileErr } = await rClient.from('profiles').update({
    name: 'Berkeley Kitchen Co-op',
    phone: '(510) 555-1200',
    address: '2150 Shattuck Avenue',
    city: 'Berkeley',
    state: 'CA',
    zip_code: '94704',
    email: RESTAURANT_EMAIL,
  }).eq('id', restaurantId);

  if (rProfileErr) console.error('Restaurant profile update failed:', rProfileErr.message);
  else console.log('✓ Restaurant profile updated: Berkeley Kitchen Co-op');

  // --- Update Restaurant donation ---
  const { error: donationErr } = await rClient.from('donations').update({
    food_type: 'Prepared meals, salads, soups, baked goods',
    quantity: 80,
    pickup_window: 'Mon-Fri 2:00 PM - 6:00 PM, Sat 12:00 PM - 3:00 PM',
  }).eq('restaurant_id', restaurantId);

  if (donationErr) console.error('Donation update failed:', donationErr.message);
  else console.log('✓ Restaurant donation updated');

  // --- Update Shelter profile ---
  const { error: sProfileErr } = await sClient.from('profiles').update({
    name: 'Berkeley Hope Community Center',
    phone: '(510) 555-3400',
    address: '1901 Martin Luther King Jr Way',
    city: 'Berkeley',
    state: 'CA',
    zip_code: '94709',
    email: SHELTER_EMAIL,
  }).eq('id', shelterId);

  if (sProfileErr) console.error('Shelter profile update failed:', sProfileErr.message);
  else console.log('✓ Shelter profile updated: Berkeley Hope Community Center');

  // --- Clear existing shelter requests for this shelter ---
  // First delete chat messages and responses that reference these requests
  const { data: existingRequests } = await sClient.from('shelter_requests').select('id').eq('shelter_id', shelterId);
  if (existingRequests && existingRequests.length > 0) {
    const ids = existingRequests.map(r => r.id);
    await sClient.from('chat_messages').delete().in('request_id', ids);
    await sClient.from('request_responses').delete().in('request_id', ids);
    await sClient.from('shelter_requests').delete().eq('shelter_id', shelterId);
    console.log(`✓ Cleared ${existingRequests.length} old request(s)`);
  }

  // --- Create shelter requests ---
  const requests = [
    {
      shelter_id: shelterId,
      title: 'Weekend Lunch for 40 Families',
      quantity: 40,
      food_needed: 'Hot meals, rice, beans, vegetables',
      food_restrictions: 'Nut-free, no shellfish',
      pickup_window: 'Saturday 10:00 AM - 12:00 PM',
      urgency: 'high',
      notes: 'We serve 40 families every Saturday. Need hot meals ready for immediate serving. Please include disposable containers.',
      address: '1901 Martin Luther King Jr Way',
      city: 'Berkeley',
      state: 'CA',
      zip_code: '94709',
      status: 'open',
    },
    {
      shelter_id: shelterId,
      title: 'Weekday Dinner Supply - 25 Servings',
      quantity: 25,
      food_needed: 'Pasta, soups, bread, salads',
      food_restrictions: 'Vegetarian options needed',
      pickup_window: 'Mon-Wed 4:00 PM - 5:30 PM',
      urgency: 'medium',
      notes: 'Regular weekday dinner program. We need at least 8 vegetarian portions out of 25. Hot or easily reheatable preferred.',
      address: '1901 Martin Luther King Jr Way',
      city: 'Berkeley',
      state: 'CA',
      zip_code: '94709',
      status: 'open',
    },
    {
      shelter_id: shelterId,
      title: 'Emergency Breakfast Supplies',
      quantity: 30,
      food_needed: 'Sandwiches, fruit, juice, muffins',
      food_restrictions: 'Gluten-free options appreciated',
      pickup_window: 'Tomorrow 7:00 AM - 8:30 AM',
      urgency: 'high',
      notes: 'Unexpected influx of 15 new residents overnight. Urgent need for breakfast items. Any grab-and-go items welcome.',
      address: '1901 Martin Luther King Jr Way',
      city: 'Berkeley',
      state: 'CA',
      zip_code: '94709',
      status: 'open',
    },
    {
      shelter_id: shelterId,
      title: 'Monthly Community Meal Event',
      quantity: 100,
      food_needed: 'Catered platters, chicken, rice, mixed vegetables, desserts',
      food_restrictions: 'Halal and vegetarian options required',
      pickup_window: 'April 20, 11:00 AM - 1:00 PM',
      urgency: 'low',
      notes: 'Monthly community gathering. We host around 100 people including families with children. Need diverse menu with halal and vegetarian options. Desserts for kids appreciated.',
      address: '2939 Ellis Street',
      city: 'Berkeley',
      state: 'CA',
      zip_code: '94703',
      status: 'open',
    },
    {
      shelter_id: shelterId,
      title: 'After-School Snack Packs - 20 Kids',
      quantity: 20,
      food_needed: 'Snack packs, fruit cups, granola bars, juice boxes',
      food_restrictions: 'Peanut-free (school allergy policy)',
      pickup_window: 'Weekdays 2:00 PM - 3:00 PM',
      urgency: 'medium',
      notes: 'Daily after-school program for neighborhood kids ages 6-14. Need individually packaged snacks that are peanut-free per our policy.',
      address: '1901 Martin Luther King Jr Way',
      city: 'Berkeley',
      state: 'CA',
      zip_code: '94709',
      status: 'open',
    },
    {
      shelter_id: shelterId,
      title: 'Fresh Produce for Weekly Distribution',
      quantity: 50,
      food_needed: 'Fresh fruits, vegetables, herbs',
      food_restrictions: null,
      pickup_window: 'Thursday 9:00 AM - 11:00 AM',
      urgency: 'low',
      notes: 'We run a weekly fresh produce distribution for 50 households. Any surplus produce, even imperfect items, is welcome.',
      address: '1901 Martin Luther King Jr Way',
      city: 'Berkeley',
      state: 'CA',
      zip_code: '94709',
      status: 'open',
    },
  ];

  const { data: insertedRequests, error: insertError } = await sClient
    .from('shelter_requests')
    .insert(requests)
    .select('id, title');

  if (insertError) {
    console.error('Failed to create requests:', insertError.message);
  } else {
    console.log(`\n✓ Created ${insertedRequests.length} shelter requests:`);
    insertedRequests.forEach(r => console.log(`  - ${r.title}`));
  }

  console.log('\n=== Done ===');
}

main().catch(console.error);
