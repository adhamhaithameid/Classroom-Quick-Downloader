#!/bin/bash
set -e

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}Starting Oracle Backend Verification...${NC}"

# Navigate to oracle-backend directory
cd "$(dirname "$0")/../oracle-backend"

echo -e "\n${GREEN}1. Verifying Code (go vet)...${NC}"
go vet ./...

echo -e "\n${GREEN}2. Running Tests (go test)...${NC}"
go test -v ./...

echo -e "\n${GREEN}3. Verifying Docker Build (dry run)...${NC}"
# Use DOCKER_BUILDKIT=1 for better performance and caching
if command -v docker >/dev/null 2>&1; then
  # We just build without saving the image to save time/disk
  DOCKER_BUILDKIT=1 docker build . -t oracle-backend-test:latest
  echo -e "${GREEN}Docker build succeeded.${NC}"
else
  echo -e "${RED}Docker not found. Skipping Docker build verification.${NC}"
fi

echo -e "\n${GREEN}✅ Oracle Backend Verification Passed!${NC}"
