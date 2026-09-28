# AgrikAIzen — Vercel deployment

This project is a mobile-first web app for farmers, buyers, and cooperatives. It preserves the green, rounded-card visual language supplied in the reference screens and uses the supplied AgrikAIzen logo for the splash screen and navigation.

## What works

- Email/password registration and login with PBKDF2 password hashing.
- Persistent user records through Vercel KV / Upstash Redis.
- Role-aware farmer, buyer, and cooperative dashboards.
- Sample **Paparating na Ani** listings for buyers.
- AI price estimates through the server-side OpenAI Responses API, with safe market-guidance fallback when the AI service is temporarily unavailable.
- Filipino/English interface toggle.
- Google Maps embeds and Google Maps deep links for all user types.
- Cooperative cards using the provided `14.jpg` reference and a profile treatment based on `22.jpg`.

## Deploy to Vercel

1. Import this folder as a new Vercel project.
2. Create a Vercel KV database (or connect an Upstash Redis database) and add these environment variables from its dashboard:
   - `KV_REST_API_URL`
   - `KV_REST_API_TOKEN`
3. Add a long random `AUTH_SECRET` value. This signs login sessions.
4. Add `OPENAI_API_KEY` and optionally `OPENAI_MODEL` (defaults to `gpt-6-astra`). The key remains only in the serverless function and is never sent to the browser.
5. Deploy. Vercel installs the package dependency and routes `/api/auth/*` and `/api/estimate` automatically.

Persistent user storage is deliberately required in a Vercel deployment: an absent KV configuration produces a clear server error instead of silently pretending user accounts were saved. During local development, the API uses a temporary in-memory store.

## Security notes

- Never commit a real `.env` file or API key.
- Add the production domain to any organization restrictions applied to the OpenAI key.
- AI estimates are guidance only; they are not an offer or guarantee of a market price.
