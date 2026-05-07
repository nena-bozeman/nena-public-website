#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

npm run cms:use-dev-config

npx decap-server &
npm run dev -- --host
