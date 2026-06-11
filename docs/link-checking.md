# Link checking

CI validates links in two ways after a production build:

| Check | Command | What it does |
|-------|---------|----------------|
| **Internal** | `pnpm run check:internal-links` | Scans built HTML in `dist/` and resolves internal `href`s against the filesystem (Astro `base`, trailing slashes, relative paths). Implemented in [`scripts/check-internal-links.mjs`](../scripts/check-internal-links.mjs). |
| **External** | `pnpm run check:external-links` | HTTP-checks outbound URLs in `dist/` using [Lychee](https://lychee.cli.rs/). Configured in [`.lychee.toml`](../.lychee.toml). CI job: `check-external-links` in [`.github/workflows/ci.yml`](../.github/workflows/ci.yml). |

Run the full local gate (including both link checks): **`make ci`**.

## Install Lychee (local only)

CI installs Lychee automatically via [`lycheeverse/lychee-action`](https://github.com/lycheeverse/lychee-action). You only need a local install to run `pnpm run check:external-links` or `make ci` on your machine.

### macOS (recommended)

From the repo root, install everything in the [`Brewfile`](../Brewfile):

```bash
brew bundle
lychee --version
```

Or install Lychee alone:

```bash
brew install lychee
lychee --version
```

### Linux

```bash
# Homebrew on Linux
brew install lychee

# Or Cargo (Rust toolchain required)
cargo install lychee
```

### Other platforms

Download a release binary from [lycheeverse/lychee releases](https://github.com/lycheeverse/lychee/releases), extract it, and put `lychee` on your `PATH`.

## Run external link check

Build first — Lychee scans the static output, not source Markdown:

```bash
pnpm run build
pnpm run check:external-links
```

Verbose Lychee output (optional):

```bash
lychee --config .lychee.toml --verbose dist/
```

## Configuration

[`.lychee.toml`](../.lychee.toml) at the repo root controls timeouts, concurrency, excludes (same-origin URLs, legacy Craft `/files/*` routes, Google Maps loader), and hosts that often return **403** to CI bots. Edit that file when a URL is legitimately unreachable from GitHub Actions but fine in a browser.

Lychee caches results in `.lycheecache` (gitignored) to speed up repeat runs.

## Troubleshooting

- **`lychee: command not found`** — Install with `brew install lychee` (see above) or use `make ci` only after installing.
- **`Missing build output: dist`** — Run `pnpm run build` first.
- **Intermittent failures** — Re-run locally; third-party sites rate-limit or block automated requests. Check whether the URL works in a browser before changing content or excludes.
