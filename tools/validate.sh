#!/bin/bash
set -e

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}Starting Codebase Validation...${NC}"

# Navigate to worker directory
cd "$(dirname "$0")/../cloudflare-worker"

echo -e "\n${GREEN}1. Running Static Analysis (Lint, Typecheck, Audit)...${NC}"
pnpm run validate

echo -e "\n${GREEN}2. Starting Local Preview (wrangler dev)...${NC}"
# Start wrangler dev in background
# Use port 8788 to avoid conflicts with other dev servers if any
pnpm wrangler dev --port 8788 > /dev/null 2>&1 &
WRANGLER_PID=$!

# Function to cleanup
cleanup() {
  echo -e "\n${GREEN}Stopping wrangler dev (PID: $WRANGLER_PID)...${NC}"
  kill $WRANGLER_PID 2>/dev/null || true
}
trap cleanup EXIT

# Wait for wrangler to start
echo "Waiting for worker to initialize..."
sleep 5

echo -e "\n${GREEN}3. Testing Health Endpoint...${NC}"
HEALTH_URL="http://127.0.0.1:8788/health"
HTTP_CODE=""
for attempt in {1..30}; do
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$HEALTH_URL" || true)
  if [ "$HTTP_CODE" == "200" ]; then
    break
  fi
  sleep 1
done

if [ "$HTTP_CODE" == "200" ]; then
  echo -e "${GREEN}Health check PASSED (Status: 200)${NC}"
else
  echo -e "${RED}Health check FAILED (Status: $HTTP_CODE)${NC}"
  echo "Expected 200, got $HTTP_CODE"
  exit 1
fi

echo -e "\n${GREEN}✅ All Checks Passed! Codebase is ready for deployment.${NC}"
exit 0
