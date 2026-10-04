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
4. Add `OPENAI_API_KEY` and optionally `OPENAI_MODEL` (defaults to `gpt-5.6-luna`). The key remains only in the serverless function and is never sent to the browser.
5. Official Philippine Statistics Authority farmgate prices are available automatically through the built-in PSA OpenSTAT connector; no government API token is required. `PSA_OPENSTAT_BASE_URL` is optional and defaults to the official endpoint shown in `.env.example`. `GOV_PRICE_API_URL` and `GOV_PRICE_API_TOKEN` remain optional for an additional licensed institutional feed that returns normalized `price`, `location`, `date`, and `source` fields.
6. To enable browser push notifications, generate a VAPID key pair and add `VAPID_SUBJECT`, `VAPID_PUBLIC_KEY`, and `VAPID_PRIVATE_KEY`. `VAPID_SUBJECT` should be a `mailto:` address or HTTPS URL.
7. Deploy. Vercel installs the package dependencies and routes the API functions automatically.

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
- Buyer Requests shows crop, quantity, offered price and location. Matching requests appear first, then records with known distances.
- Highest price shows other farmers' listings sorted by offered price.
- Buyers can post public crop needs and send offers to a specific farmer listing. The farmer bell opens pending requests. AI-assisted offer assessment marks an offer fair or low against the listing's estimate, while leaving the accept, reject, and counter decision with the farmer.
- Accepted offers reserve the confirmed quantity so the same harvest cannot be oversold. A confirmed deal then asks the farmer to choose a delivery partner, cooperative transport, or buyer pickup.
- Logistics partners, cooperatives, and buyers receive only the delivery jobs appropriate to their role. The assigned provider accepts the job, starts delivery, and marks it complete.
- Completion records an auditable payment breakdown: the farmer receives the full produce amount, the buyer owes produce plus delivery, the provider receives the delivery fee less commission, and AgrikAIzen receives the configured 5% delivery commission (within the requested 3–8% range). This release records the breakdown; it does not move money through a payment gateway.
- Push notifications use the service worker when VAPID is configured. The in-app offer bell and transaction screens remain available when notification permission is not granted.
- /api/market verifies the signed session and loads the account role from server storage. Published listings, needs and offers persist in KV. Atomic compare-and-swap prevents lost updates; concurrent edits ask the user to retry.
- Buyer subscriptions follow two server-enforced tiers. **Pro (`plan: "pro"`) is ₱299/month** and includes Smart Sourcing, advanced supplier filters, supplier comparison with clearly labelled transport estimates, market price intelligence, and supplier management. **Enterprise (`plan: "enterprise"`) is ₱999/month** and adds bulk sourcing, harvest alerts, recurring orders, procurement analytics, and CSV export. Buyers can choose a plan in the app; the request is saved as `pending_payment` and does not grant paid access. A payment provider or administrator must provision `plan` after successful payment. Demo Mode switches plan previews immediately. Legacy `plan: "premium"` accounts are treated as Enterprise. Registration cannot grant itself a paid entitlement.
- Subscription prices and access rules are shown in the app. Subscription payment, trial activation, geocoding, automatic plan provisioning, and real payment settlement are not implemented. Forecasts and price intelligence identify their records and present PSA observations as official monthly farmgate statistics, not real-time prices.
- Demo mode is explicitly separate: sample market records and changes use agri_market_demo_v1 in this browser. Demo estimates use sample guidance. Demo data is never sent to production.
- The Community tab is available to every user role. Signed-in users share a persistent feed where they can publish categorized posts, react with Helpful, Support, or Celebrate, and add comments. Users can delete their own posts, while administrators can remove any post. The API enforces authorship and moderation permissions; demo community activity remains only in the current browser.
- The PDF transaction flow is connected end to end. Farmers can save and resume private harvest drafts before publishing. Buyer requests include a needed-by date and are matched against a farmer's active crop, available quantity, listing price, and harvest date. Matching requests raise the farmer alert, appear first in the Buyer Requests screen, and support crop/area filtering, skip, and buyer messages. A farmer can propose a matching listing; the buyer can accept, reject, or counter, after which the existing AI offer check, farmer decision, delivery selection, logistics progress, commission, and payment breakdown continue normally.

## Complete key-feature implementation

- **Adaptive fair-price estimates:** community selling-price reports, completed transactions, and active listings contribute weighted evidence to the estimator. OpenAI receives the calculated market context and optional seven-day Open-Meteo weather summary. The deterministic fallback uses the same market records when OpenAI is unavailable.
- **Supply and demand outlook:** the Market Intelligence page compares active available quantities with buyer-request quantities for each crop, labels shortage, balanced, or oversupply risk, and publishes a confidence level based on record coverage.
- **Selling-time comparison:** the app compares selling now with a short wait using demand-to-supply ratio, observed price movement, and crop perishability. OpenAI can explain the result but cannot override or invent the supplied statistics.
- **Price trends and regional comparison:** monthly weighted price history and location-level averages use community reports, verified completed transactions, and current listings. Every result displays its source coverage.
- **Community price reporting:** farmers and cooperatives can submit actual sale date, quantity, price, buyer/market, and location. Completed transactions can be verified records; administrators can verify or reject community reports. Accepted records immediately affect future estimates without claiming that a foundation model was retrained.
- **PSA OpenSTAT connector:** market analysis and AI estimates retrieve official PSA monthly farmgate prices for the selected crop and prefer province-level observations when available, with a national fallback. Results retain the PSA source, commodity, location, and observation month. Administrators can persist the retrieved records without creating duplicates. `GOV_PRICE_API_URL` remains available for an optional additional normalized institutional feed.
- **Intelligent matching:** Premium sourcing scores eligible suppliers using crop, quantity, price, date, location, quality, and farming method, then explains the matching factors. Farmers also receive crop/date/quantity/price buyer-request matches, while the intelligence page recommends crop-appropriate cooperatives.
- **Direct communication:** buyer-request conversations support farmer messages and buyer replies. Every offer has a two-way negotiation thread alongside accept, reject, counter, delivery, and payment status.
- **Assisted Farmer Mode:** a cooperative records a farmer's explicit consent, creates a managed profile, publishes a listing on the farmer's behalf, and manages the resulting buyer offer and logistics flow.
- **Voice entry:** supported browsers can dictate harvest variety and location using the Web Speech API. Unsupported browsers receive a clear message and all fields remain usable by touch or keyboard.
- **Post-harvest support:** the existing crop-processing guide remains available for drying, pickling, sauce or juice processing, and milling. Intelligence recommendations account for high-, medium-, and low-perishability crops.

The prediction and trend features are decision support, not guaranteed forecasts. Their reliability depends on the quantity, recency, geographic coverage, and verification status of available records.

### Verification

Run `npm test` (Node 22). Tests cover ownership, invalid inputs, duplicate publishing, AI offer assessment, counter-offers, inventory reservation, all logistics status transitions, the payment split, premium authorization, filtering, bulk offers, alerts, saved suppliers, recurring orders, community posting/reactions/comments/deletion/moderation, concurrency, and Filipino/English rendering. Open index.html through a local web server for the demo. Authenticated flows require the Vercel API environment and KV setup. External OpenAI, deployed KV, and browser push delivery are not exercised by the local test suite.
