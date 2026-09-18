#!/usr/bin/env bash
# Set the AMO signing secrets on the GitHub repo so the signed-Firefox CI leg
# activates (qa-firefox-signed project + nightly/PR validation, gh #617).
#
# Usage:
#   1. Generate API keys at https://addons.mozilla.org/developers/addon/api/key/
#      (requires your AMO session; the JWT secret is shown ONCE — copy both).
#   2. Run: ./scripts/set-amo-secrets.sh <jwt-issuer> <jwt-secret>
#
# Requires: gh CLI authenticated with admin on the repo (verified 2026-09-18).
set -euo pipefail

ISSUER="${1:?usage: $0 <jwt-issuer> <jwt-secret>}"
SECRET="${2:?usage: $0 <jwt-issuer> <jwt-secret>}"
REPO="${GH_REPO:-adhamhaithameid/Classroom-Quick-Downloader}"

gh secret set AMO_JWT_ISSUER --repo "$REPO" --body "$ISSUER"
gh secret set AMO_JWT_SECRET --repo "$REPO" --body "$SECRET"
echo "Done. Both secrets set on $REPO."
echo "The e2e workflow's signed-Firefox leg activates on the next push/nightly run."
echo "Rotate or revoke anytime at https://addons.mozilla.org/developers/addon/api/key/"
