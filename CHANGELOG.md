# Changelog

All notable changes to this project are documented here. Entries are derived from the git history and grouped by release period.

## [Unreleased]

Changes not yet released.

---

## 2026-04-22

- **News drafts:** Boolean `draft` on news entries so unfinished posts are omitted from production builds but still appear in development; `NewsDraftBadge.astro` on listings and post pages; filtering consolidated in `news.ts` and applied across news index, pagination, tag, home, and objective-related views; Decap CMS field in `public/admin/config.yml`.
- **Business geocoding:** Batch address geocoding via `scripts/geocode-business-addresses.mjs` with Geocoding API setup noted in `.env.example`; refined coordinates and optional image fields in business front matter feed the map, cards, and detail pages, with supporting helpers (`business-image.ts`, `website-label.ts`, category utilities).

## 2026-04-21

- **Google map (business directory):** **Map** view on `/businesses` (list / map toggle) using the **Google Maps JavaScript API** via `BusinessMap.astro` and a **`PUBLIC_GOOGLE_MAPS_API_KEY`** in the environment. Category-colored pins, legend, info windows, and overlapping-pin spreading (`business-map-points.ts`); map initializes when the map tab is shown, with a clear message when the key is missing or the API is misconfigured.
- **Business hero / cover images:** Per-listing cover art in `src/assets/businesses/<slug>.*`, resolved with `getBusinessCoverImage()` and shown on `BusinessCard` and business detail pages. **Batch fetch** of `og:image` / `twitter:image` from public sites with `scripts/fetch-business-hero-images.mjs`, with **manual** assets for listings where a site has no useful preview, only a logo, or a fetch fails.
- **Business directory:** Many Northeast / Northside business listings added as markdown entries with individual pages; main directory list and map limited to **open** listings.
- **Business status and archive:** Replaced `active` with **`status`** (`open` | `closed`) and optional **`closedYear`** in the content schema; **`/businesses/archive`** page for past businesses; cards and detail pages show closed state; Decap CMS business fields updated.
- **Business content corrections:** **Misco Mill** kept open; **Live from the Divide** marked closed (former Bozeman location; venue now in Livingston); removed erroneous closed status from Misco Mill.
- **News and objectives:** Link news posts to objectives via tags; filter and display related news on objective pages (`ObjectiveRelatedNews`, `news.ts` utilities).
- **Meeting minutes:** Meeting minutes archive and improved base URL handling for assets and links.
- **Legacy migration:** Inventory scripts and news backfill tooling for migrating content from the legacy site.

## 2026-04-19

- **Navigation and content:** Navigation and footer updates; objectives order and titles; timeline and footer with images and layout tweaks.
- **Legacy redirects:** Initial `_redirects` mapping from old URLs to the new site.
- **Branding and UX:** Favicon, logo, Tailwind styling, simplified header, email copy clarification.
- **Quality:** Internal link checker enhancements (verbose output, skip reasons); CI workflow and dependency updates.
- **Tooling:** Legacy inventory management scripts and data; migration-related documentation under `public/documents/migrated` and scripts.

## 2026-04-14

- **Core site:** Initial static NENA website (Astro): pages, content collections, layouts, and styling.
- **Security:** Astro upgraded to 5.15.8 (patch for reflected XSS advisory).
- **CMS / admin:** Decap CMS admin route and `config.yml` path fixes for Astro 5 dev server and GitHub Pages.
- **Hosting:** GitHub Actions workflow to publish to GitHub Pages; `BASE_URL` applied across internal links for project-page hosting.
- **Repository:** `.gitignore` added; build artifacts and `node_modules` removed from tracking.

## 2026-04-13

- **Bootstrap:** Initial repository and merge of the first static-site implementation (pull request #1).

---

### Earlier planning

- Initial planning and prompt artifacts committed at the start of the project (`Initial commit`, `Initial plan`, `initial prompt for building the site`).
