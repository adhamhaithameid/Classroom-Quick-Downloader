#!/bin/bash
# Oracle Backend Deploy Script
# Run this on the server to manually deploy or update the backend

set -e

cd ~/oracle-backend

echo "======================================"
echo "🚀 Oracle Backend Deployment"
echo "======================================"

# Pull latest changes
echo ""
echo "📥 Pulling latest changes from oracle-deploy branch..."
git fetch origin oracle-deploy
git reset --hard origin/oracle-deploy

# Set deploy time for status endpoint
export DEPLOY_TIME=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
export GIT_COMMIT=$(git rev-parse HEAD)

echo ""
echo "📦 Building and restarting containers..."
docker-compose down || true
docker-compose up -d --build

echo ""
echo "🧹 Cleaning up old images..."
docker image prune -f

echo ""
echo "⏳ Waiting for service to start..."
sleep 5

echo ""
echo "🔍 Verifying health..."
if curl -sf http://localhost:8080/health > /dev/null; then
    echo "✅ Health check passed!"
else
    echo "❌ Health check failed!"
    docker-compose logs --tail=50
    exit 1
fi

echo ""
echo "======================================"
echo "✅ Deployment complete!"
echo "Commit: $GIT_COMMIT"
echo "Time: $DEPLOY_TIME"
echo "======================================"
echo ""
echo "Dashboard: http://129.151.233.229:8080/"
echo ""

# Show recent logs
docker-compose logs --tail=10 oracle-backend
