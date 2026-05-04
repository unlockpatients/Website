# CLAUDE.md

**Built Sunday, March 22nd, 2026 — off of Reach's hours. Entire LP funnel + tracking pixel architecture conceived and built outside of consulted hours, without access to their tracking systems or proprietary code.**

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Hosting — read this first

**The site is hosted on AWS, NOT GitHub Pages.** Apex + `www` are served by CloudFront `E29L503GVUKNC9` from S3 `unlockpatients-ulp-main-website` (us-west-2). `book.unlockpatients.com` is fronted by an EC2 Caddy proxy (`3.231.255.154`) → CloudFront → S3. Files in this repo are uploaded with `aws s3 sync` (or equivalent). Earlier versions of this file claimed GitHub Pages — that was wrong; the migration to AWS happened earlier in 2026. Full topology + verification commands are in `~/Desktop/brain/wiki/entities/unlockpatients-com-hosting.md`.

## ⚠️ S3 IS THE SOURCE OF TRUTH — NOT THIS REPO

**Read this before editing any HTML in this repo.** This is the single biggest footgun on this project.

The Framer-exported pages (`index.html`, `team/index.html`, `book/index.html`, `contact/index.html`) get re-published from Framer directly into S3 by Alex without going through this repo. That means **the file in S3 is frequently newer than the file in this repo**. If you edit the local copy and `aws s3 cp` it up, you will silently overwrite real, in-production content (Our Story section, blog footer links, navbar variants, hero copy) with whatever stale base happened to be sitting in the repo.

This *will* happen if you don't follow the workflow below. It already happened once in May 2026 — restoring required pulling old object versions out of S3.

### Before any HTML edit, do this:

```bash
# 1. Pull the LIVE version from S3 — never trust the local file as a base.
aws s3 cp s3://unlockpatients-ulp-main-website/index.html ./index.html --region us-west-2
aws s3 cp s3://unlockpatients-ulp-main-website/team/index.html  ./team/index.html  --region us-west-2
aws s3 cp s3://unlockpatients-ulp-main-website/book/index.html  ./book/index.html  --region us-west-2
aws s3 cp s3://unlockpatients-ulp-main-website/contact/index.html ./contact/index.html --region us-west-2
```

Then make your edits, deploy, and **commit the deployed file back to git in the same step** so the repo tracks reality. Never edit the in-repo Framer file without first refreshing it from S3.

### S3 versioning is ENABLED — use it for recovery

If the wrong file gets deployed, you can recover.

```bash
# List recent versions of an object (most recent first):
aws s3api list-object-versions \
  --bucket unlockpatients-ulp-main-website \
  --prefix index.html \
  --region us-west-2 \
  --max-items 20 \
  --query 'Versions[].[VersionId,LastModified,Size]' \
  --output table

# Pull a specific version into /tmp/ for inspection:
aws s3api get-object \
  --bucket unlockpatients-ulp-main-website \
  --key index.html \
  --version-id <VersionId-from-above> \
  --region us-west-2 \
  /tmp/idx-prior.html

# Promote that version back to current (copy on top of itself):
aws s3 cp /tmp/idx-prior.html s3://unlockpatients-ulp-main-website/index.html \
  --content-type "text/html; charset=utf-8" \
  --cache-control "public, max-age=300" \
  --region us-west-2

# Then invalidate CloudFront:
aws cloudfront create-invalidation --distribution-id E29L503GVUKNC9 --paths "/" "/index.html" --region us-east-1
```

**Do not disable S3 versioning on this bucket.** It is the recovery mechanism for this exact class of mistake.

### Deploy checklist

For every deploy of a Framer-exported HTML file:

1. **Pull live first.** `aws s3 cp s3://.../<file> ./<file>` before editing — even if you "just edited it five minutes ago". Re-pull.
2. **Edit & verify locally.** `grep` for content you expect to still be there (e.g. `grep -c "Our Story" index.html` should be ≥ 4 on the homepage).
3. **Deploy.** `aws s3 cp <file> s3://...` with `--content-type "text/html; charset=utf-8" --cache-control "public, max-age=300"`.
4. **Invalidate.** `aws cloudfront create-invalidation --distribution-id E29L503GVUKNC9 --paths "/" "/<file>"`.
5. **Verify live.** `curl -s https://unlockpatients.com/?cb=$(date +%s) | grep -c "Our Story"` should match what you expect. Don't trust caches — always cache-bust the curl.
6. **Commit the deployed file to git** (same commit, same author `AlexanderLangone`). The git repo should reflect what's currently on S3, never lag behind it.

### When the issue still happens

Symptoms that you (or the next agent) just clobbered Framer-published content:
- Pages look "older" than what the user remembers
- Sections present on the live site disappear (Our Story, story carousels, footer additions)
- Navbar reverts to a previous variant
- User says "Framer overwrote stuff again" — but really, it was your stale base that overwrote Framer

**Recovery**: list versions of the affected key (above), find the one from before your deploy, pull it down, re-apply only the patches that actually need to change, redeploy. See the May 2026 recovery in this repo's git history (`09db2f1`) for a worked example: pulled prior versions of `index.html` (versionId `cWcDktdUsqyLvmBDLeVAm7CvDh_iBiHe`), `team/index.html`, `book/index.html`, `contact/index.html` from S3, re-applied the WKP hero card replacement + Team-link runtime injection, redeployed.

### Why we don't just freeze Framer

Alex actively edits the marketing site in Framer. Re-exports happen on the user's schedule, not yours. The workflow is **collaborative**: Framer owns the site shell, runtime, and ongoing content edits; targeted JS patches in this repo (or via Framer's Site Settings → Custom Code) own the parts that need to survive re-export. Don't try to "migrate off Framer" — it's a deliberate hybrid (see `~/Desktop/brain/wiki/concepts/unlockpatients-homepage-framer-hybrid-baseline.md`).

## Analytics + session recording — installed 2026-04-27

This site is now linked to the **Unlock Patients** practice (id `00cafc4c-3a8c-4c8d-8741-b976e370ae0f`, ClientRegistry `clientCode='ulp-main'`) inside the Dashboard at `dashboard.unlockpatients.com`. Two snippets must live on every page:

1. **GA4** — measurement ID `G-Z6T87J4ECL` (`gaSource='auto'`, owned by Unlock Patients' GA4 service account). Lives wrapped in `<!--GA4_HEAD_START-->...<!--GA4_HEAD_END-->` markers right after `<head>`.
2. **Unlock Patients tracking pixel** — the standard Dashboard tracking script (`var CC='ulp-main',API='https://gt1fes5qxf.execute-api.us-east-1.amazonaws.com/prod'`). Lives right before `</body>`. Loads `/assets/rrweb-all.min.js` for **session recording on every visit** (the registry has `recordAllSessions:true`, so the `gclid`-only gate is skipped). Posts events to `POST /tracking/ulp-main/event` and replays to `POST /tracking/ulp-main/recording`.

### Where the snippets live in this repo

- **Hand-coded pages** (already injected as of 2026-04-27): `privacy-policy/index.html`, `lp/pediatric-practices/index.html`, `lp/schedule/index.html`, `lp/thank-you/index.html`. Just `aws s3 sync` from the repo and they ship correctly.
- **Framer-exported pages** (`index.html`, `book/index.html`, `contact/index.html`, `team/index.html`): edits to these files in this repo get **overwritten on every Framer re-export**. To keep the snippets surviving re-exports, paste both snippets into **Framer → Site Settings → Custom Code**:
  - **Head (start)**: paste the GA4 snippet (the entire `<!--GA4_HEAD_START-->...<!--GA4_HEAD_END-->` block).
  - **End of body**: paste the tracking-pixel snippet (the `<script>(function(){var CC='ulp-main'...})();</script>` block).
- **`assets/rrweb-all.min.js`** must exist in the bucket (170 KB). It's not in this repo; the Dashboard's onboarding Lambda copies it from `unlockpatients-dashboard-hosting-314146331828/assets/rrweb-all.min.js` whenever `republish-tracking` runs. If you ever delete the bucket's copy by accident, run from the dashboard repo: `aws s3 cp s3://unlockpatients-dashboard-hosting-314146331828/assets/rrweb-all.min.js s3://unlockpatients-ulp-main-website/assets/rrweb-all.min.js --content-type application/javascript --cache-control "public, max-age=31536000" --metadata-directive REPLACE`.

### How to refresh tracking on the live bucket

If the snippets ever drift (a Framer re-export removes them, or the script content changes), the Dashboard exposes a scoped admin trigger:

```bash
# From the Dashboard_On_AWS_Hosted repo:
aws lambda invoke --function-name unlockpatients-dashboard-onboarding --region us-east-1 \
  --cli-binary-format raw-in-base64-out \
  --payload '{"requestContext":{"http":{"method":"POST"},"authorizer":{"jwt":{"claims":{"sub":"<your-cognito-sub>"}}}},"rawPath":"/onboarding/republish-tracking","httpMethod":"POST","queryStringParameters":{"clientCode":"ulp-main"}}' \
  /tmp/out.json && cat /tmp/out.json

# And to refresh GA4 on every page:
# aws lambda invoke ... --payload '{"...","rawPath":"/onboarding/practice/00cafc4c-3a8c-4c8d-8741-b976e370ae0f/ga4/ensure",...}'
```

Both are admin-scoped (require `isAdmin` JWT). They strip stale snippets, inject fresh ones, and invalidate CloudFront `E29L503GVUKNC9`.

## Project Overview

Static website for Unlock Patients (unlockpatients.com), a patient acquisition service for medical practices. Hosted on AWS S3+CloudFront (see "Hosting" above). Also contains AWS infrastructure templates for client onboarding and a shared tracking system.

## Architecture: Two-Part Site

**Main site** — Framer-exported pages (`index.html`, `book/`, `contact/`, `team/`). These are machine-generated 200-600KB HTML files. Treat as read-only; edits are overwritten on Framer re-export. The `privacy-policy/` page is the exception — it's hand-coded.

### Main-site Framer guardrails

The main pages are **self-hosted static HTML on S3/CloudFront**, but they are still **Framer exports**. They contain Framer-generated markup, breakpoint CSS, `data-framer-*` attributes, serialized handover data, remote Framer module scripts, and Framer-hosted assets. Do not assume that self-hosted means Framer can be removed without a migration.

- **Do not replace Framer navs wholesale** with `nav.innerHTML = ...` or other full-DOM rewrites. That breaks Framer's spacing, responsive variants, hydration behavior, and button styling.
- If a Framer nav must be adjusted, patch existing anchors/text/images in place and hide extra nav items with CSS classes.
- Correct Unlock Patients logo asset: `https://framerusercontent.com/images/MK3ZA72VmM2Zcgx78FRA4ESOhk.png?width=489&height=73`.
- Known wrong logo for Unlock Patients headers/navs: `https://framerusercontent.com/images/QsslTZGr59YDAZgiwNDUNbkDBJE.png?width=640&height=94` (Nurture Pediatrics).
- Before publishing header/nav changes, verify `rg -n "nav\\.innerHTML|QsslTZGr59YDAZgiwNDUNbkDBJE|MK3ZA72VmM2Zcgx78FRA4ESOhk" index.html book/page.html contact/page.html team/page.html case-studies`.

**Landing page funnel** (`/lp/`) — Hand-coded HTML/CSS/JS for Google Ads conversion. Three page types:
- `/lp/{keyword}/index.html` — Squeeze landing pages (one per ad keyword)
- `/lp/schedule/index.html` — Shared multi-step qualifying form (all keywords redirect here)
- `/lp/thank-you/index.html` — Post-booking page (banner + iframe of main site)

Shared assets live in `/lp/_assets/` (css, js, img). Keyword pages only differ in content; all behavior/styling comes from shared files.

## LP Funnel Flow

1. Google Ad → `/lp/{keyword}/?utm_source=google&...`
2. Email form submit → redirects to `/lp/schedule/?email=X&lp={keyword}&utm_*=...`
3. 6-step form: Contact Info → Role → Practice Type → Timeline → US/Canada geo-check (auto-skips if IP is US/CA) → Cal.com booking
4. Booking confirmed → `/lp/thank-you/`

## Key JS Architecture

- **`up-tracker.js`** — Unlock Patients tracking pixel (replaces PostHog). Lightweight ~3KB. API: `UPTracker.init({apiUrl, apiKey})`, `.track(event, props)`, `.identify(userId, traits)`. Batches events in memory, flushes every 3s or on page unload via `sendBeacon`. Sends to `https://t.unlockpatients.com/track` with `x-api-key` header. Ad-blocker resistant: self-hosted script + first-party domain.
- **`lp-core.js`** — Runs on all LP pages. Captures UTMs into cookies + localStorage (30-day), handles all `.lp-email-form` submissions, exit intent popup, sticky nav. Exposes `window.UP_UTM` for cross-file UTM access.
- **`form-engine.js`** — State machine for `/lp/schedule/`. Manages step navigation, validation, localStorage persistence, ipapi.co geolocation, lead scoring. Lead submissions go through UPTracker as `lead_submitted` events (no separate API endpoint). Exposes `window.FormEngine`.
- **`cal-embed.js`** — Lazy-loads Cal.com embed on step 6 only. Listens for booking success via postMessage + Cal callback, then redirects to thank-you.

Radio/card selections on steps 2-4 auto-advance after 300ms delay.

## Tracking Architecture

Uses own "Unlock Patients tracking pixel" instead of PostHog (PostHog free tier limited to 1 project; we need tracking across multiple client practices). One shared write-only endpoint serves all clients:

```
Client Website → POST t.unlockpatients.com/track (x-api-key: client_key)
                        ↓
              Shared API Gateway + Lambda (tracking-stack.yaml, deploy once)
                        ↓
              Client Registry Table → resolves API key → client code + table name
                        ↓
              Writes to client's DynamoDB table (separate per client)
```

**Two CF templates:**
- `tracking-stack.yaml` — Deploy ONCE. Shared API GW, Tracking Ingest Lambda, Client Registry DynamoDB table, Registrar Lambda (CF custom resource helper), custom domain `t.unlockpatients.com` with ACM cert.
- `ClientTemplateEditV11.yaml` — Per-client. Creates tracking events table (`distinct_id` + `timestamp` keys, KMS encrypted) + auto-registers in shared registry via CF custom resource. Also includes DNI, Connect, Google Ads conversion upload, and Client Data API.

**Lambda code:**
- `lambda/tracking-ingest/index.js` — Resolves client from API key (5-min in-memory cache), validates CORS origin, strips IP (HIPAA), batch writes events to client's DynamoDB table. Max 50 events per request.
- `lambda/tracking-registrar/index.js` — CF custom resource handler. On Create: generates `up_` prefixed API key, writes to registry. On Delete: removes from registry. Returns API key as CF output.

**Security model:** API keys are write-only (can only push events, never read). Origin-validated. Rate-limited via API Gateway. IP never stored (HIPAA). Each client's data is in a separate DynamoDB table.

**Tracked events:**

| Event | Source | Key Properties |
|-------|--------|----------------|
| `lp_page_viewed` | lp-core.js | keyword_page, UTMs |
| `lp_email_submitted` | lp-core.js | keyword_page, form_location, email_domain |
| `exit_intent_shown` | lp-core.js | keyword_page |
| `form_field_changed` | form-engine.js | step, field, value |
| `form_step_completed` | form-engine.js | step, step_name, lead_score |
| `lead_submitted` | form-engine.js | all form data, lead_score, is_final, UTMs |
| `demo_booked` | cal-embed.js | keyword_page, lead_score, practice_type, role, timeline |
| `thankyou_page_viewed` | thank-you HTML | (auto-properties only) |

## Brand Design Tokens (in lp-base.css)

Primary purple: `rgb(135, 101, 215)` / Light bg: `rgb(247, 240, 250)` / Text: `rgba(76, 40, 28, 0.9)` / Headings: `rgb(72, 57, 83)` / Display font: Anton / Body font: Figtree

## Adding a New Keyword Landing Page

1. Copy `lp/pediatric-practices/index.html` to `lp/{new-keyword}/index.html`
2. Update `window.LP_CONFIG.keyword`, `<title>`, hero H1/H2, feature blocks, testimonials, FAQ
3. Sections to change are marked with `<!-- KEYWORD-SPECIFIC -->` comments
4. All CSS, JS, tracking, and form behavior are inherited from shared assets

## Configuration Placeholders

Two values must be set before launch (search for these strings):
- `YOUR_API_KEY` — in each HTML file's `<head>` UPTracker init (output from client CF stack's `TrackingApiKey`)
- `YOUR_CAL_LINK` — in `lp/_assets/js/cal-embed.js` (e.g., `unlockpatients/45min-demo`)

## Development

No build system, package manager, or test framework. All files are plain HTML/CSS/JS served directly by GitHub Pages.

To preview locally: `python3 -m http.server 8000` from the repo root, then visit `http://localhost:8000/lp/pediatric-practices/`

Deploy website: push to `main` branch. GitHub Pages serves from root with CNAME `unlockpatients.com`.

Deploy tracking infra: see Next Steps below.

## Conventions

- LP pages use `noindex, nofollow` meta tags (not meant for search engines)
- Tracking events follow pattern: `lp_*` for landing page events, `form_*` for form events, `lead_submitted` for form data, `demo_booked` and `thankyou_page_viewed` for conversions
- Lead data is submitted twice: partial after form step 1 (`is_final: false`), complete after booking (`is_final: true`)
- Self-hosted logo at `/lp/_assets/img/logo.png` — do not reference framerusercontent.com URLs in LP pages
- No PostHog anywhere — all analytics go through UPTracker → t.unlockpatients.com

## Next Steps (not yet done)

### AWS Deployment
1. **ACM certificate** — Request cert for `t.unlockpatients.com` in the target AWS region (must be same region as API Gateway for REGIONAL endpoint)
2. **Deploy `tracking-stack.yaml`** — Pass cert ARN as parameter. Creates shared API GW, Lambdas, registry table, custom domain
3. **DNS record** — Create CNAME or Route 53 alias pointing `t.unlockpatients.com` → the `TrackingDomainTarget` output from the stack
4. **Package Lambda code** — Zip `lambda/tracking-ingest/` → upload as `tracking-ingest-v1.zip` to the Lambda code S3 bucket. Same for `lambda/tracking-registrar/` → `tracking-registrar-v1.zip`
5. **Deploy updated `ClientTemplateEditV11.yaml`** for Unlock Patients as a client — will create tracking events table + register in shared registry
6. **Set `YOUR_API_KEY`** in HTML files — use the `TrackingApiKey` output from the client stack

### Cal.com Setup
7. **Create Cal.com event** — 45-minute demo slots, set availability, configure confirmation emails
8. **Set `YOUR_CAL_LINK`** in `cal-embed.js` — e.g., `unlockpatients/45min-demo`

### Content & Launch
9. **Replace placeholder images** — Hero dashboard preview, feature block images, account manager photo (marked with `<div class="placeholder-img">` in keyword pages)
10. **Replace placeholder testimonials** — Current ones are fictional; swap with real client quotes
11. **Replace placeholder social proof logos** — "Google Partner", "Meta Partner" etc. in the social proof bar
12. **Create additional keyword landing pages** — Copy pediatric-practices template for other specialties (dentistry, dermatology, etc.)
13. **Set up Google Ads campaigns** — Point ads to `/lp/{keyword}/?utm_source=google&utm_medium=cpc&...`
14. **Test full funnel end-to-end** — Ad click → LP → email submit → form steps → Cal.com booking → thank-you page. Verify events appear in DynamoDB tracking table.
