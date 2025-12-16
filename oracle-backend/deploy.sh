#!/bin/bash
# Simple deploy helper for the Oracle Backend
# Run this on the server after pulling code changes.

echo "Rebuilding and restarting Oracle Backend..."
docker-compose up -d --build --remove-orphans

echo "Pruning unused images..."
docker image prune -f

echo "Done. Checking logs..."
docker-compose logs --tail=20 oracle-backend
