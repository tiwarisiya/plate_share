# PlateShare

A Next.js food-sharing platform connecting restaurants with shelters via Supabase.

## Stack

- **Framework**: Next.js 16 (App Router) with TypeScript
- **Styling**: Tailwind CSS v4
- **Backend/DB**: Supabase (auth + database)
- **Runtime**: Node.js 20

## Project Structure

```
src/
  app/           # Next.js App Router pages
    restaurant/  # Restaurant-side routes (home, chat, donation, settings, profile)
    shelter/     # Shelter-side routes (home, chat, login, register)
  components/    # Shared UI components (ui/, SplashScreen)
  lib/
    supabaseClient.ts  # Supabase singleton client
    flow.ts            # App flow logic
supabase/        # Supabase config/migrations
public/          # Static assets
```

## Environment Variables Required

- `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase anonymous/public key

These must be set as Replit secrets.

## Running

- Dev: `npm run dev` (port 5000, all hosts)
- Build: `npm run build`
- Start: `npm start` (port 5000, all hosts)

## Notes

- Migrated from Vercel to Replit — `.env.local` manual reader removed from `next.config.ts`; env vars are now read from Replit secrets directly.
- Port is fixed to 5000 to match Replit's webview proxy.
