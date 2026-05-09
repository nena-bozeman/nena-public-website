.PHONY: ci rss-to-notes

# List Mailchimp campaigns from the NENA archive RSS (see docs/rss-to-notes.md)
rss-to-notes:
	pnpm run rss-to-notes

# Mirrors .github/workflows/ci.yml (install, astro check, tests, Pages + CF builds & link checks)
ci:
	CI=true pnpm install --frozen-lockfile
	pnpm run check
	pnpm test
	pnpm run build
	pnpm run check:internal-links
	pnpm run check:internal-links:cf
