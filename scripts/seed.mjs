import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function main() {
  console.log('Fetching existing profiles...');
  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('id, role, name, email, phone, address, city, state, zip_code');

  if (profilesError) {
    console.error('Failed to fetch profiles:', profilesError.message);
    process.exit(1);
  }

  const restaurants = profiles.filter(p => p.role === 'restaurant');
  const shelters = profiles.filter(p => p.role === 'shelter');

  console.log(`Found ${restaurants.length} restaurant(s) and ${shelters.length} shelter(s)`);

  if (restaurants.length === 0 || shelters.length === 0) {
    console.log('Need at least one restaurant and one shelter to seed data.');
    process.exit(0);
  }

  // --- Clear existing seed data ---
  console.log('Clearing old seed data...');
  await supabase.from('chat_messages').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('request_responses').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('shelter_requests').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('donations').delete().neq('id', '00000000-0000-0000-0000-000000000000');

  const r = restaurants[0];
  const r2 = restaurants[1] || restaurants[0];
  const s = shelters[0];
  const s2 = shelters[1] || shelters[0];

  const now = new Date();
  const daysAgo = (n) => new Date(now - n * 86400000).toISOString();

  // --- Update shelter profile names to realistic values ---
  console.log('Updating shelter profile names...');
  await supabase.from('profiles').update({ name: "St. Mary's Family Shelter" }).eq('id', s.id);
  if (s2.id !== s.id) {
    await supabase.from('profiles').update({ name: "Riverside Community Center" }).eq('id', s2.id);
  }
  s.name = "St. Mary's Family Shelter";
  s2.name = s2.id !== s.id ? "Riverside Community Center" : s.name;

  // --- Donations for restaurants ---
  console.log('Creating donations...');
  const { data: donations, error: donErr } = await supabase
    .from('donations')
    .insert([
      {
        restaurant_id: r.id,
        restaurant_name: r.name,
        address: r.address,
        city: r.city,
        state: r.state,
        zip_code: r.zip_code,
        food_type: 'Hot meals (pasta, salad, bread)',
        quantity: 80,
        pickup_window: 'Today 3:00 PM – 5:00 PM',
        status: 'matched',
        matched_shelter_id: s.id,
        created_at: daysAgo(2),
      },
      {
        restaurant_id: r2.id,
        restaurant_name: r2.name,
        address: r2.address,
        city: r2.city,
        state: r2.state,
        zip_code: r2.zip_code,
        food_type: 'Sandwiches and wraps',
        quantity: 40,
        pickup_window: 'Tomorrow 11:00 AM – 1:00 PM',
        status: 'posted',
        created_at: daysAgo(1),
      },
      {
        restaurant_id: r.id,
        restaurant_name: r.name,
        address: r.address,
        city: r.city,
        state: r.state,
        zip_code: r.zip_code,
        food_type: 'Soups and stews',
        quantity: 60,
        pickup_window: 'Friday 4:00 PM – 6:00 PM',
        status: 'posted',
        created_at: daysAgo(5),
      },
    ])
    .select();

  if (donErr) {
    console.error('Donation insert error:', donErr.message);
    process.exit(1);
  }

  const don1 = donations[0];
  const don2 = donations[1];

  // --- Shelter requests ---
  console.log('Creating shelter requests...');
  const { data: requests, error: reqErr } = await supabase
    .from('shelter_requests')
    .insert([
      // MATCHED - will have chat
      {
        shelter_id: s.id,
        title: 'Hot dinner for 75 residents',
        request_type: 'Hot meals',
        food_needed: 'Hot meals (pasta, salad, bread)',
        food_restrictions: 'No pork. One resident has a severe nut allergy.',
        quantity: 75,
        pickup_window: 'Today 3:00 PM – 5:00 PM',
        urgency: 'high',
        notes: 'Serving dinner at 6 PM. Please arrive by 5:30 PM at the latest.',
        coordination_notes: 'Use the side entrance on Elm St. Ask for Maria at the front desk.',
        status: 'matched',
        matched_donation_id: don1.id,
        shelter_contact_email: s.email,
        shelter_contact_phone: s.phone,
        address: s.address,
        city: s.city,
        state: s.state,
        zip_code: s.zip_code,
        created_at: daysAgo(2),
      },
      // OPEN 1 - lunch for families
      {
        shelter_id: s.id,
        title: 'Lunch for 40 families',
        request_type: 'Sandwiches / cold food',
        food_needed: 'Sandwiches, wraps, or cold food',
        food_restrictions: 'Halal preferred. No shellfish.',
        quantity: 40,
        pickup_window: 'Tomorrow 11:00 AM – 1:00 PM',
        urgency: 'medium',
        notes: 'We distribute lunch at noon. Food should be ready to serve — no reheating equipment on-site.',
        status: 'open',
        shelter_contact_email: s.email,
        shelter_contact_phone: s.phone,
        address: s.address,
        city: s.city,
        state: s.state,
        zip_code: s.zip_code,
        created_at: daysAgo(1),
      },
      // OPEN 2 - weekend soup kitchen
      {
        shelter_id: s2.id,
        title: 'Weekend soup kitchen – 60 servings',
        request_type: 'Soups / stews',
        food_needed: 'Soups or stews',
        food_restrictions: 'Vegetarian options required for at least 20 servings.',
        quantity: 60,
        pickup_window: 'Saturday 10:00 AM – 12:00 PM',
        urgency: 'medium',
        notes: 'Our volunteers will be on-site from 10 AM to help unload and serve.',
        status: 'open',
        shelter_contact_email: s2.email,
        shelter_contact_phone: s2.phone,
        address: s2.address,
        city: s2.city,
        state: s2.state,
        zip_code: s2.zip_code,
        created_at: daysAgo(3),
      },
      // OPEN 3 - urgent dinner for youth shelter
      {
        shelter_id: s2.id,
        title: 'Dinner for 25 youth residents',
        request_type: 'Hot meals',
        food_needed: 'Any hot entree — rice dishes, chicken, pasta',
        food_restrictions: 'No pork. Avoid very spicy food.',
        quantity: 25,
        pickup_window: 'Today 5:00 PM – 6:30 PM',
        urgency: 'high',
        notes: 'Kids eat dinner at 7 PM. We need food delivered to the side door by 6:30 PM at the latest.',
        status: 'open',
        shelter_contact_email: s2.email,
        shelter_contact_phone: s2.phone,
        address: s2.address,
        city: s2.city,
        state: s2.state,
        zip_code: s2.zip_code,
        created_at: daysAgo(0.1),
      },
      // OPEN 4 - weekly breakfast program
      {
        shelter_id: s.id,
        title: 'Weekly breakfast – 50 servings',
        request_type: 'Breakfast items',
        food_needed: 'Pastries, fruit, yogurt, or any breakfast items',
        food_restrictions: 'Nut-free required. One resident has a dairy allergy — please label dairy items.',
        quantity: 50,
        pickup_window: 'Friday 7:30 AM – 9:00 AM',
        urgency: 'low',
        notes: 'This is a recurring weekly program. Reliable partners are especially welcome.',
        status: 'open',
        shelter_contact_email: s.email,
        shelter_contact_phone: s.phone,
        address: s.address,
        city: s.city,
        state: s.state,
        zip_code: s.zip_code,
        created_at: daysAgo(2),
      },
      // COMPLETED
      {
        shelter_id: s.id,
        title: 'Emergency breakfast – 30 servings',
        request_type: 'Breakfast items',
        food_needed: 'Pastries, fruit, coffee',
        food_restrictions: 'None',
        quantity: 30,
        pickup_window: 'Last Monday 8:00 AM – 9:00 AM',
        urgency: 'high',
        notes: 'Early morning pickup — staff will be there from 7:45 AM.',
        status: 'fulfilled',
        matched_donation_id: null,
        shelter_contact_email: s.email,
        shelter_contact_phone: s.phone,
        address: s.address,
        city: s.city,
        state: s.state,
        zip_code: s.zip_code,
        created_at: daysAgo(7),
      },
    ])
    .select();

  if (reqErr) {
    console.error('Request insert error:', reqErr.message);
    process.exit(1);
  }

  const matchedReq = requests[0];
  const openReq1 = requests[1];

  // --- Request responses ---
  console.log('Creating request responses...');
  const { error: respErr } = await supabase
    .from('request_responses')
    .insert([
      // Accepted response on matched request
      {
        request_id: matchedReq.id,
        restaurant_id: r.id,
        donation_id: don1.id,
        proposed_pickup_window: 'Today 3:00 PM – 5:00 PM',
        response_note: 'We can cover all 75 servings. Pasta and salad ready by 3 PM. Our driver will call 15 min before arrival.',
        status: 'accepted',
        created_at: daysAgo(2),
      },
    ]);

  if (respErr) {
    console.error('Response insert error:', respErr.message);
    process.exit(1);
  }

  // --- Chat messages for the matched request ---
  console.log('Creating chat messages...');
  const chatMessages = [
    {
      request_id: matchedReq.id,
      sender_id: r.id,
      sender_role: 'restaurant',
      message: "Hi! We're confirmed for today. Our driver Marco will be there around 3:15 PM with pasta, salad, and bread for 75.",
      created_at: daysAgo(1.8),
    },
    {
      request_id: matchedReq.id,
      sender_id: s.id,
      sender_role: 'shelter',
      message: "Perfect, thank you! Please use the side entrance on Elm Street — our staff member Maria will meet you there.",
      created_at: daysAgo(1.75),
    },
    {
      request_id: matchedReq.id,
      sender_id: r.id,
      sender_role: 'restaurant',
      message: "Got it. Quick question — do you have chafing dishes to keep things warm, or should we bring our own?",
      created_at: daysAgo(1.7),
    },
    {
      request_id: matchedReq.id,
      sender_id: s.id,
      sender_role: 'shelter',
      message: "We have two chafing dishes on-site. That should be enough for the pasta and stew. The salad can go straight into our serving bowls.",
      created_at: daysAgo(1.65),
    },
    {
      request_id: matchedReq.id,
      sender_id: r.id,
      sender_role: 'restaurant',
      message: "Great — we'll bring a separate container for the salad then. See you at 3:15!",
      created_at: daysAgo(1.6),
    },
    {
      request_id: matchedReq.id,
      sender_id: s.id,
      sender_role: 'shelter',
      message: "Looking forward to it. Our residents really appreciate this. Thank you so much! 🙏",
      created_at: daysAgo(1.55),
    },
  ];

  const { error: chatErr } = await supabase.from('chat_messages').insert(chatMessages);
  if (chatErr) {
    console.error('Chat insert error:', chatErr.message);
    process.exit(1);
  }

  console.log('✅ Seed complete!');
  console.log(`  - ${donations.length} donations created`);
  console.log(`  - ${requests.length} shelter requests created (1 matched, 4 open, 1 fulfilled)`);
  console.log('  - 1 request response created (accepted/matched)');
  console.log(`  - ${chatMessages.length} chat messages created`);
}

main().catch(err => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
