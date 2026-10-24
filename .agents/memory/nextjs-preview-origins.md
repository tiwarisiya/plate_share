---
name: Next.js preview origins
description: Replit preview-host compatibility for Next.js development server origin checks.
---

When Next.js 16 blocks HMR from a Replit preview, `*.replit.dev` may not cover the nested `*.janeway.replit.dev` proxy hostname; allow the nested preview suffix in `allowedDevOrigins`.

**Why:** Next.js checks the full preview hostname, and the Replit preview proxy uses a nested host. Without the more specific wildcard, HMR is rejected even though the page itself loads.

**How to apply:** If workflow logs report a blocked cross-origin request to `/_next/hmr`, inspect the current Replit preview host and allow its matching suffix in the development-only `allowedDevOrigins` list.
