#!/bin/bash
# Test the full CQD analytics pipeline locally
# Usage: .tools/test_pipeline.sh

set -e

WORKER_URL="http://localhost:8787"
ORACLE_URL="http://localhost:8080"
# Optional admin secret for force-flush testing (never hardcode).
SECRET="${PIPELINE_ADMIN_SECRET:-}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== CQD Analytics Pipeline Test ===${NC}"
echo ""

# 1. Health checks
echo -e "${YELLOW}1. Checking Oracle Backend health...${NC}"
ORACLE_HEALTH=$(curl -s "$ORACLE_URL/health" 2>/dev/null || echo '{"error":"cannot connect"}')
echo "$ORACLE_HEALTH" | jq . 2>/dev/null || echo "$ORACLE_HEALTH"
echo ""

echo -e "${YELLOW}2. Checking Worker health...${NC}"
WORKER_HEALTH=$(curl -s "$WORKER_URL/health" 2>/dev/null || echo '{"error":"cannot connect"}')
echo "$WORKER_HEALTH" | jq . 2>/dev/null || echo "$WORKER_HEALTH"
echo ""

# 3. Check initial worker stats
echo -e "${YELLOW}3. Current worker stats (before sending events)...${NC}"
curl -s "$WORKER_URL/stats" 2>/dev/null | jq '{
  totalEvents: .totalEvents,
  pendingEvents: .pendingEvents,
  lastFlushAt: .lastFlushAt
}' 2>/dev/null || echo "Worker not available"
echo ""

# 4. Send test events
echo -e "${YELLOW}4. Sending 6 test events to worker...${NC}"
TIMESTAMP=$(date +%s)000

for i in {1..6}; do
  if [ $((i % 3)) -eq 0 ]; then
    STATUS="fail"
    ERROR_TYPE='"error_type": "DOWNLOAD_TIMEOUT",'
  else
    STATUS="success"
    ERROR_TYPE=""
  fi
  
  FILE_TYPES=("pdf" "docx" "pptx" "xlsx" "zip" "jpg")
  FILE_TYPE=${FILE_TYPES[$((i % 6))]}
  
  DURATION=$((RANDOM % 5000 + 500))
  
  echo -n "  Event $i ($STATUS, $FILE_TYPE): "
  RESPONSE=$(curl -s -X POST "$WORKER_URL/track" \
    -H "Content-Type: application/json" \
    -d "{
      \"events\": [{
        \"status\": \"$STATUS\",
        \"file_type\": \"$FILE_TYPE\",
        \"browser\": \"chrome\",
        \"os\": \"macos\",
        \"ext_version\": \"2.1.0\",
        \"duration_ms\": $DURATION,
        \"bypass_used\": false,
        \"language\": \"en-US\",
        \"country\": \"US\",
        $ERROR_TYPE
        \"timestamp\": $((TIMESTAMP + i * 1000)),
        \"source\": \"test_script\"
      }]
    }" 2>/dev/null)
  
  echo "$RESPONSE" | jq -r '.ok // .error // "error"' 2>/dev/null || echo "failed"
done
echo ""

# 5. Check worker stats after sending
echo -e "${YELLOW}5. Worker stats after sending events...${NC}"
curl -s "$WORKER_URL/stats" 2>/dev/null | jq '{
  totalEvents: .totalEvents,
  totalDownloads: .totalDownloads,
  totalSuccess: .totalSuccess,
  totalFail: .totalFail,
  pendingEvents: .pendingEvents,
  lastFlushAt: .lastFlushAt,
  retryState: .retryState
}' 2>/dev/null || echo "Worker not available"
echo ""

# 6. Check if auto-flush happened (should have since MAX_BATCH_EVENTS=5)
echo -e "${YELLOW}6. Checking Oracle backend for ingested data...${NC}"
SUMMARY=$(curl -s "$ORACLE_URL/api/stats/summary" 2>/dev/null)
echo "$SUMMARY" | jq '{
  status: .status,
  totalDownloads: .totalDownloads,
  totalSuccess: .totalSuccess,
  totalFail: .totalFail,
  successRate: .successRate,
  lastBatch: .lastBatch
}' 2>/dev/null || echo "Oracle not available or no data yet"
echo ""

# 7. If no data, try force flush
PENDING=$(curl -s "$WORKER_URL/stats" 2>/dev/null | jq -r '.pendingEvents // 0')
if [ "$PENDING" -gt 0 ] 2>/dev/null; then
  if [ -n "$SECRET" ]; then
    echo -e "${YELLOW}7. Pending events detected ($PENDING), forcing flush...${NC}"
    curl -s -X POST "$WORKER_URL/admin/force-flush" \
      -H "X-Admin-Secret: $SECRET" 2>/dev/null | jq . 2>/dev/null || echo "Flush failed"
    echo ""
    
    echo -e "${YELLOW}8. Re-checking Oracle after flush...${NC}"
    sleep 1
    curl -s "$ORACLE_URL/api/stats/summary" 2>/dev/null | jq '{
      status: .status,
      totalDownloads: .totalDownloads,
      lastBatch: .lastBatch
    }' 2>/dev/null || echo "Oracle not available"
    echo ""
  else
    echo -e "${YELLOW}7. Pending events detected ($PENDING), skipping force flush (set PIPELINE_ADMIN_SECRET).${NC}"
    echo ""
  fi
fi

# 8. Test other Oracle endpoints
echo -e "${YELLOW}9. Testing Oracle timeseries endpoint...${NC}"
curl -s "$ORACLE_URL/api/stats/timeseries?granularity=hour" 2>/dev/null | jq '{
  ok: .ok,
  granularity: .granularity,
  pointCount: (.points | length)
}' 2>/dev/null || echo "Endpoint not available"
echo ""

echo -e "${YELLOW}10. Testing Oracle breakdown endpoint...${NC}"
curl -s "$ORACLE_URL/api/stats/breakdown?dimension=type" 2>/dev/null | jq '{
  ok: .ok,
  dimension: .dimension,
  values: .values
}' 2>/dev/null || echo "Endpoint not available"
echo ""

echo -e "${GREEN}=== Test Complete ===${NC}"
echo -e "Open ${BLUE}http://localhost:8080${NC} to view the dashboard"
