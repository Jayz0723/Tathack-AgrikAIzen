# AgrikAIzen — Vercel deployment

This project is a mobile-first web app for farmers, buyers, and cooperatives. It preserves the green, rounded-card visual language supplied in the reference screens and uses the supplied AgrikAIzen logo for the splash screen and navigation.

## What works

- Email/password registration and login with PBKDF2 password hashing.
- Persistent user records through Vercel KV / Upstash Redis.
- Role-aware farmer, buyer, cooperative, and logistics dashboards.
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
5. To enable browser push notifications, generate a VAPID key pair and add `VAPID_SUBJECT`, `VAPID_PUBLIC_KEY`, and `VAPID_PRIVATE_KEY`. `VAPID_SUBJECT` should be a `mailto:` address or HTTPS URL.
6. Deploy. Vercel installs the package dependencies and routes the API functions automatically.

Persistent user storage is deliberately required in a Vercel deployment: an absent KV configuration produces a clear server error instead of silently pretending user accounts were saved. During local development, the API uses a temporary in-memory store.

## Security notes

- Never commit a real `.env` file or API key.
- Add the production domain to any organization restrictions applied to the OpenAI key.
- AI estimates are guidance only; they are not an offer or guarantee of a market price.

## Marketplace update (October 2026)

- Readability update: the app uses larger type, stronger contrast, 48–54 px controls, clearer button wording, and an enlarged bottom navigation designed for farmers with limited eyesight or smartphone experience. Demo roles are shown as separate bordered choices.
- The Wika menu supports English and Tagalog throughout the app. Cebuano, Ilocano, and Hiligaynon are available as beta choices with translated core navigation; untranslated text falls back to Tagalog and is labelled honestly in the selector.
- Today’s Prices now opens a dedicated list of every supported crop. It uses active listing prices when available and clearly labels fallback guide prices. The AI estimator remains a separate action.
- Crop Planning accepts the crop and location, then calculates the next recommended planting window and estimated harvest window using common Philippine growing seasons and crop-duration ranges. Results state that local weather, variety, soil, and municipal agriculture guidance can change the schedule.
- Farmer flow: List harvest → crop details and listing type → AI price estimator → Publish listing or Cancel. Cancelling never creates a listing; repeat publication of the same draft is idempotent.
- Types: pre-harvest, fresh harvest, emergency harvest. Quantity and prices use kg and PHP/kg.
- Farmer profiles show only listings owned by the signed-in farmer.
- Nearest shows buyer requests with crop, quantity, offered price and location. Records with known distances sort first; actual geocoding/distance calculation is not configured. Production listings without ratings are labelled Not yet rated; demo ratings are clearly sample data.
- Highest price and Top rated show other farmers' listings. Highest price sorts descending; unrated listings sort after rated listings.
- Buyers can post public crop needs and send offers to a specific farmer listing. The farmer bell opens pending requests. AI-assisted offer assessment marks an offer fair or low against the listing's estimate, while leaving the accept, reject, and counter decision with the farmer.
- Accepted offers reserve the confirmed quantity so the same harvest cannot be oversold. A confirmed deal then asks the farmer to choose a delivery partner, cooperative transport, or buyer pickup.
- Logistics partners, cooperatives, and buyers receive only the delivery jobs appropriate to their role. The assigned provider accepts the job, starts delivery, and marks it complete.
- Completion records an auditable payment breakdown: the farmer receives the full produce amount, the buyer owes produce plus delivery, the provider receives the delivery fee less commission, and AgrikAIzen receives the configured 5% delivery commission (within the requested 3–8% range). This release records the breakdown; it does not move money through a payment gateway.
- Push notifications use the service worker when VAPID is configured. The in-app offer bell and transaction screens remain available when notification permission is not granted.
- /api/market verifies the signed session and loads the account role from server storage. Published listings, needs and offers persist in KV. Atomic compare-and-swap prevents lost updates; concurrent edits ask the user to retry.
- Buyer Premium follows the supplied business plan. It includes Smart Sourcing, advanced filters, supplier comparison with clearly labelled transport estimates, bulk requests, harvest alerts, saved suppliers, recurring orders, procurement analytics, regional/current/historical price summaries, upcoming listed-supply summaries, and CSV export. Premium access is enforced on the server and requires the stored account field `plan: "premium"`; registration cannot grant itself this entitlement.
- The business-plan prices (Pro ₱299/month and Enterprise ₱999/month) are shown for reference. Subscription payment, trial activation, geocoding, automatic plan provisioning, and real payment settlement are not implemented. Forecasts and price intelligence explicitly identify the records they use and do not claim live government data.
- Demo mode is explicitly separate: sample market records and changes use agri_market_demo_v1 in this browser. Demo estimates use sample guidance. Demo data is never sent to production.
- The Community tab is available to every user role. Signed-in users share a persistent feed where they can publish categorized posts, react with Helpful, Support, or Celebrate, and add comments. Users can delete their own posts, while administrators can remove any post. The API enforces authorship and moderation permissions; demo community activity remains only in the current browser.

### Verification

Run `npm test` (Node 22). Tests cover ownership, invalid inputs, duplicate publishing, AI offer assessment, counter-offers, inventory reservation, all logistics status transitions, the payment split, premium authorization, filtering, bulk offers, alerts, saved suppliers, recurring orders, community posting/reactions/comments/deletion/moderation, concurrency, and Filipino/English rendering. Open index.html through a local web server for the demo. Authenticated flows require the Vercel API environment and KV setup. External OpenAI, deployed KV, and browser push delivery are not exercised by the local test suite.
