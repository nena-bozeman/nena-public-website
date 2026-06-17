# Google Calendar events sync

Production deploys sync event markdown from `src/content/events/` to the NENA community Google Calendar. Decap CMS editors do not need to touch the calendar directly — publish to `main` and the [deploy workflow](../.github/workflows/deploy-cloudflare.yml) runs `pnpm sync:google-calendar` after the site build.

**Production only:** sync is not wired into [preview.yml](../.github/workflows/preview.yml) or [ci.yml](../.github/workflows/ci.yml). Live writes also require `NENA_CALENDAR_SYNC_ALLOW=1`, which only the production deploy workflow sets. Local runs must use `--dry-run` unless you explicitly opt in.

Sync state (slug, content hash) is stored on each Google Calendar event via extended properties. No Cloudflare KV or D1 is required.

## Prerequisites

- Admin access to the Google Calendar used on the [Events page](../src/components/events/EventsIndexSections.astro) (`PUBLIC_GOOGLE_CALENDAR_ID`, default `nenabozeman@gmail.com`).
- Admin access to the GitHub repository **Settings → Secrets and variables → Actions** (production environment).

---

## Todo: Google Cloud

- [ ] **Create or select a GCP project**
  [Google Cloud Console](https://console.cloud.google.com/) → select project or **Create project**.

- [ ] **Enable the Google Calendar API**
  APIs & Services → **Library** → search **Google Calendar API** → **Enable**.

- [ ] **Create a service account**
  IAM & Admin → **Service Accounts** → **Create service account** (e.g. `nena-website-calendar-sync`).

- [ ] **Create and download a JSON key**
  Service account → **Keys** → **Add key** → **JSON**. Store the file securely; you will paste its contents into GitHub as a secret.

- [ ] **Copy the service account email**
  Looks like `nena-website-calendar-sync@your-project.iam.gserviceaccount.com`.

---

## Todo: Share the calendar

- [ ] **Open Google Calendar settings** for the NENA community calendar (`PUBLIC_GOOGLE_CALENDAR_ID`).

- [ ] **Share with the service account**
  Settings → **Share with specific people** → add the service account email → permission **Make changes to events** → Save.

The service account cannot accept email invites; sharing must be done from the calendar owner's settings.

---

## Todo: GitHub secrets

Add these to the **`cloudflare-production`** environment (or repository secrets used by [deploy-cloudflare.yml](../.github/workflows/deploy-cloudflare.yml)):

| Secret | Value |
|--------|-------|
| `GOOGLE_CALENDAR_SERVICE_ACCOUNT_JSON` | Full contents of the service account JSON key file |
| `PUBLIC_GOOGLE_CALENDAR_ID` | Calendar ID (e.g. `nenabozeman@gmail.com`) |

`ASTRO_SITE` is set to `https://nenabozeman.org` in the production deploy workflow so event page links in calendar descriptions use the live domain.

---

## Local dry-run

1. Copy `.env.example` to `.env` (or export variables in your shell).
2. Set `GOOGLE_CALENDAR_SERVICE_ACCOUNT_JSON` to the JSON key contents (single line is fine).
3. The sync script loads `.env` and `.env.local` automatically.
4. Run:

```bash
pnpm sync:google-calendar --dry-run
```

Add `--verbose` to log skipped no-op updates. Remove `--dry-run` only when you intend to write to the live calendar.

---

## How sync works

| Action | Trigger |
|--------|---------|
| **Create** | New event markdown file on `main` deploy |
| **Update** | Changed title, dates, location, summary, body, cancelled state, or external URL |
| **Delete** | Event markdown file removed from the repo |
| **Skip** | No content change (hash matches) |

Only calendar events tagged with `nenaSource=website` (created by this sync) are updated or deleted. Manually added calendar entries are left alone.

Cancelled events stay on the calendar with a `[CANCELLED]` title prefix.

---

## Troubleshooting

| Error | Fix |
|-------|-----|
| `403` / `Forbidden` | Calendar not shared with the service account, or permission is view-only |
| `404` / `Not Found` | Wrong `PUBLIC_GOOGLE_CALENDAR_ID` |
| `Invalid credentials` | Malformed `GOOGLE_CALENDAR_SERVICE_ACCOUNT_JSON` secret |
| `Refusing to write to Google Calendar` | Live sync blocked without `NENA_CALENDAR_SYNC_ALLOW=1` — use `--dry-run` locally |
| Sync not running | Only [deploy-cloudflare.yml](../.github/workflows/deploy-cloudflare.yml) on `main` runs sync — not PR previews or CI |
