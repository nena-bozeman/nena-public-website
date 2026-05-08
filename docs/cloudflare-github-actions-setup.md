# Cloudflare Workers previews via GitHub Actions

The workflow [`.github/workflows/preview.yml`](../.github/workflows/preview.yml) builds with **`pnpm run build:cf`** (root-hosted Worker output; must match `pnpm run deploy:cf`) and uploads a **preview** using **`wrangler versions upload`** via [`cloudflare/wrangler-action@v3`](https://github.com/cloudflare/wrangler-action). That publishes a preview URL for the **Workers + assets** project defined in [`wrangler.jsonc`](../wrangler.jsonc) (`name` is currently **`nena-public-website`**; static files come from `dist`).

This path uses the **Wrangler / Workers API**, not the Cloudflare **Pages** build API—there is no separate Pages project required for previews.

Use this checklist when onboarding a new fork or rotating credentials.

## Prerequisites

- Access to the Cloudflare account that owns the Worker (see `name` in `wrangler.jsonc`).
- Admin access to the GitHub repository **Settings → Secrets and variables → Actions**.

---

## Todo: Cloudflare dashboard

- [x] **Confirm the Worker exists**
  Cloudflare Dashboard → **Workers & Pages** → open the Worker whose name matches `name` in `wrangler.jsonc`. Create it if needed (e.g. first local `pnpm run deploy:cf` or dashboard **Create**).

- [x] **Use GitHub Actions as the only Git-driven deploy (recommended)**
  If this Worker is **also** connected to the GitHub repo under **Settings → Builds** (or legacy Git integration), Cloudflare will build and deploy on every push **in addition** to this workflow—duplicate previews and confusing deployment history. **Disconnect** the repo from Cloudflare for builds and rely on **`.github/workflows/preview.yml`** for branch/PR previews.

- [x] **Copy the Account ID**
  Dashboard **Overview** (right sidebar) or the Worker’s **Settings** → copy **Account ID** (32-character hex). Store this as `CLOUDFLARE_ACCOUNT_ID`.

- [x] **Create an API token for CI**
  Dashboard → **My Profile** (or account menu) → **API Tokens** → **Create Token**.

  Recommended approach:

  - Start from template **“Edit Cloudflare Workers”**, **or** create a **Custom token** with minimal scope.

  Minimum scopes that match **`wrangler versions upload`** / Worker uploads (labels may vary slightly):

  - **Account** → **Workers Scripts** → **Edit** (or the Workers edit scope included in the template above).
  - Optionally narrow **Account Resources** to this account only.

  If deploy fails with permission errors, compare against [Cloudflare API token permissions](https://developers.cloudflare.com/fundamentals/api/reference/permissions/) and add the smallest extra scope the error asks for.

- [x] **Save the token value once**
  After creation, Cloudflare shows the token **only once**. Copy it to a password manager; you will paste it into GitHub as `CLOUDFLARE_API_TOKEN`.

```bash
# Replace repo if onboarding a fork.
gh secret set CLOUDFLARE_ACCOUNT_ID  --repo nena-bozeman/nena-public-website
gh secret set CLOUDFLARE_API_TOKEN --repo nena-bozeman/nena-public-website
```

---

## Todo: GitHub repository secrets

Repository → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**.

| Secret | Required for previews | Notes |
|--------|----------------------|--------|
| `CLOUDFLARE_ACCOUNT_ID` | Yes | From Cloudflare Overview or Worker settings. |
| `CLOUDFLARE_API_TOKEN` | Yes | Token with permission to upload Worker versions for this account. |
| `PUBLIC_GOOGLE_MAPS_API_KEY` | Yes for maps on previews | Same variable name as local `.env`; inlined at build time. |

- [x] Add **`CLOUDFLARE_ACCOUNT_ID`**
- [x] Add **`CLOUDFLARE_API_TOKEN`**
- [x] Add **`PUBLIC_GOOGLE_MAPS_API_KEY`** (if not already set for other workflows)

The workflow passes `GITHUB_TOKEN` to Wrangler automatically (`gitHubToken` in the action); no manual secret is needed for it.

---

## Verify

- [x] Open a **pull request** or push a branch **other than `main`**.
- [x] In GitHub → **Actions**, confirm **Deploy Preview** succeeds (look for **Upload Worker preview version** / Wrangler output).
- [x] In Cloudflare → **Workers & Pages** → select the Worker → **Versions** / deployment history, confirm a new **version** or preview upload appears.

---

## Related

- **Production (GitHub Pages):** [`.github/workflows/deploy-pages.yml`](../.github/workflows/deploy-pages.yml) deploys `main` with **`pnpm run build`** to **GitHub Pages**, not Cloudflare.
- **Production (Cloudflare Worker):** `pnpm run deploy:cf` runs **`pnpm run build:cf`** then **`wrangler deploy`** using `wrangler.jsonc`; that replaces production Worker traffic and is separate from **`versions upload`** previews in CI.
