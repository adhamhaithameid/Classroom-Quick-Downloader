#!/bin/bash
# Test Analytics Pipeline - Manual Testing Script

set -e

echo "=========================================="
echo "Analytics Pipeline Testing"
echo "=========================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

WORKER_URL="http://localhost:8787"
ORACLE_URL="http://localhost:8080"

echo -e "${BLUE}Step 1: Send Test Events to Cloudflare Worker${NC}"
echo "Sending 10 success + 5 fail = 15 total events"
echo ""

# Create current timestamp in milliseconds
TIMESTAMP=$(date +%s000)

# Send a batch of test events
curl -X POST "${WORKER_URL}/track" \
  -H "Content-Type: application/json" \
  -d "{
    \"events\": [
      {
        \"status\": \"success\",
        \"file_type\": \"pdf\",
        \"browser\": \"chrome\",
        \"os\": \"mac\",
        \"ext_version\": \"1.0.0\",
        \"duration_ms\": 1500,
        \"bypass_used\": false,
        \"language\": \"en-US\",
        \"timestamp\": ${TIMESTAMP}
      },
      {
        \"status\": \"success\",
        \"file_type\": \"docx\",
        \"browser\": \"chrome\",
        \"os\": \"mac\",
        \"ext_version\": \"1.0.0\",
        \"duration_ms\": 2000,
        \"bypass_used\": false,
        \"language\": \"en-US\",
        \"timestamp\": ${TIMESTAMP}
      },
      {
        \"status\": \"success\",
        \"file_type\": \"xlsx\",
        \"browser\": \"firefox\",
        \"os\": \"windows\",
        \"ext_version\": \"1.0.0\",
        \"duration_ms\": 1800,
        \"bypass_used\": true,
        \"language\": \"en-US\",
        \"timestamp\": ${TIMESTAMP}
      },
      {
        \"status\": \"success\",
        \"file_type\": \"pptx\",
        \"browser\": \"chrome\",
        \"os\": \"mac\",
        \"ext_version\": \"1.0.0\",
        \"duration_ms\": 3000,
        \"bypass_used\": false,
        \"language\": \"es-ES\",
        \"timestamp\": ${TIMESTAMP}
      },
      {
        \"status\": \"success\",
        \"file_type\": \"pdf\",
        \"browser\": \"safari\",
        \"os\": \"mac\",
        \"ext_version\": \"1.0.0\",
        \"duration_ms\": 1200,
        \"bypass_used\": false,
        \"language\": \"en-US\",
        \"timestamp\": ${TIMESTAMP}
      },
      {
        \"status\": \"success\",
        \"file_type\": \"jpg\",
        \"browser\": \"chrome\",
        \"os\": \"linux\",
        \"ext_version\": \"1.0.0\",
        \"duration_ms\": 800,
        \"bypass_used\": false,
        \"language\": \"en-US\",
        \"timestamp\": ${TIMESTAMP}
      },
      {
        \"status\": \"success\",
        \"file_type\": \"pdf\",
        \"browser\": \"edge\",
        \"os\": \"windows\",
        \"ext_version\": \"1.0.0\",
        \"duration_ms\": 1600,
        \"bypass_used\": false,
        \"language\": \"en-GB\",
        \"timestamp\": ${TIMESTAMP}
      },
      {
        \"status\": \"success\",
        \"file_type\": \"docx\",
        \"browser\": \"chrome\",
        \"os\": \"mac\",
        \"ext_version\": \"1.0.0\",
        \"duration_ms\": 2200,
        \"bypass_used\": true,
        \"language\": \"en-US\",
        \"timestamp\": ${TIMESTAMP}
      },
      {
        \"status\": \"success\",
        \"file_type\": \"zip\",
        \"browser\": \"chrome\",
        \"os\": \"mac\",
        \"ext_version\": \"1.0.0\",
        \"duration_ms\": 5000,
        \"bypass_used\": false,
        \"language\": \"en-US\",
        \"timestamp\": ${TIMESTAMP}
      },
      {
        \"status\": \"success\",
        \"file_type\": \"pdf\",
        \"browser\": \"chrome\",
        \"os\": \"mac\",
        \"ext_version\": \"1.0.0\",
        \"duration_ms\": 1400,
        \"bypass_used\": false,
        \"language\": \"fr-FR\",
        \"timestamp\": ${TIMESTAMP}
      },
      {
        \"status\": \"fail\",
        \"file_type\": \"pdf\",
        \"browser\": \"chrome\",
        \"os\": \"mac\",
        \"ext_version\": \"1.0.0\",
        \"duration_ms\": 500,
        \"bypass_used\": false,
        \"error_type\": \"NETWORK_ERROR\",
        \"language\": \"en-US\",
        \"timestamp\": ${TIMESTAMP}
      },
      {
        \"status\": \"fail\",
        \"file_type\": \"docx\",
        \"browser\": \"firefox\",
        \"os\": \"windows\",
        \"ext_version\": \"1.0.0\",
        \"duration_ms\": 800,
        \"bypass_used\": false,
        \"error_type\": \"AUTH_FAILED\",
        \"language\": \"en-US\",
        \"timestamp\": ${TIMESTAMP}
      },
      {
        \"status\": \"fail\",
        \"file_type\": \"xlsx\",
        \"browser\": \"chrome\",
        \"os\": \"mac\",
        \"ext_version\": \"1.0.0\",
        \"duration_ms\": 200,
        \"bypass_used\": false,
        \"error_type\": \"TIMEOUT\",
        \"language\": \"en-US\",
        \"timestamp\": ${TIMESTAMP}
      },
      {
        \"status\": \"fail\",
        \"file_type\": \"pdf\",
        \"browser\": \"safari\",
        \"os\": \"mac\",
        \"ext_version\": \"1.0.0\",
        \"duration_ms\": 100,
        \"bypass_used\": false,
        \"error_type\": \"BROWSER_BLOCKED\",
        \"language\": \"en-US\",
        \"timestamp\": ${TIMESTAMP}
      },
      {
        \"status\": \"fail\",
        \"file_type\": \"pptx\",
        \"browser\": \"chrome\",
        \"os\": \"linux\",
        \"ext_version\": \"1.0.0\",
        \"duration_ms\": 600,
        \"bypass_used\": false,
        \"error_type\": \"NETWORK_ERROR\",
        \"language\": \"en-US\",
        \"timestamp\": ${TIMESTAMP}
      }
    ]
  }" | jq

echo ""
echo -e "${YELLOW}Expected Result:${NC}"
echo "  ✓ 15 total events"
echo "  ✓ 10 success events"
echo "  ✓ 5 fail events"
echo "  ✓ totalDownloads should = 15 (success + fail)"
echo ""

echo -e "${BLUE}Step 2: Check Durable Object State${NC}"
echo ""
curl -s "${WORKER_URL}/stats" | jq '{
  totalEvents: .totalEvents,
  totalDownloads: .totalDownloads,
  totalSuccess: .totalSuccess,
  totalFail: .totalFail,
  pendingEvents: .pendingEvents,
  calculation_check: {
    success_plus_fail: (.totalSuccess + .totalFail),
    equals_downloads: ((.totalSuccess + .totalFail) == .totalDownloads),
    equals_events: (.totalDownloads == .totalEvents)
  }
}'

echo ""
echo -e "${BLUE}Step 3: Force Flush to Oracle Backend${NC}"
echo ""
curl -X POST "${WORKER_URL}/admin/force-flush" \
  -H "X-Admin-Secret: 123" | jq

echo ""
echo -e "${BLUE}Step 4: Check Oracle Backend Stats${NC}"
echo ""
curl -s "${ORACLE_URL}/api/stats/summary" | jq '{
  status: .status,
  totalDownloads: .totalDownloads,
  totalSuccess: .totalSuccess,
  totalFail: .totalFail,
  successRate: .successRate,
  lastBatch: {
    batchId: .lastBatch.batchId,
    eventsCount: .lastBatch.eventsCount,
    downloadsCount: .lastBatch.downloadsCount,
    successCount: .lastBatch.successCount,
    failCount: .lastBatch.failCount,
    calculation_check: {
      success_plus_fail: (.lastBatch.successCount + .lastBatch.failCount),
      equals_downloads: ((.lastBatch.successCount + .lastBatch.failCount) == .lastBatch.downloadsCount),
      equals_events: (.lastBatch.downloadsCount == .lastBatch.eventsCount)
    }
  }
}'

echo ""
echo -e "${GREEN}=========================================="
echo "Testing Complete!"
echo "==========================================${NC}"
echo ""
echo "Open the Oracle Dashboard in your browser:"
echo "  ${ORACLE_URL}"
echo ""
echo "Click '📦 Last Batch' to see the batch details"
echo ""
echo -e "${YELLOW}Verify:${NC}"
echo "  1. Downloads Count = Success Count + Fail Count"
echo "  2. Events Count = Downloads Count"
echo "  3. All numbers match what we sent (10 success + 5 fail = 15 total)"
