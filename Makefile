.DEFAULT_GOAL := help

.PHONY: help ci rss-to-notes

# Sync Mailchimp RSS into draft news stubs (see docs/rss-to-notes.md)
rss-to-notes:
	pnpm run rss-to-notes -- --write

# Mirrors .github/workflows/ci.yml (install, astro check, tests, Pages + CF builds & link checks)
ci:
	CI=true pnpm install --frozen-lockfile
	pnpm run check
	pnpm test
	pnpm run build
	pnpm run check:internal-links

# Show available targets (uses the comment above each target)
help:
	@awk '\
		/^# / { comment = substr($$0, 3); next } \
		/^[a-zA-Z][a-zA-Z0-9_.-]*:/ { \
			sub(/:.*/, "", $$1); \
			if ($$1 != "help" && comment != "") { \
				printf "  \033[36m%-20s\033[0m %s\n", $$1, comment; \
				comment = ""; \
			} \
		} \
	' $(MAKEFILE_LIST)
