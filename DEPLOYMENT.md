# Deployment Guide

This guide covers deploying the **Oracle Backend** to an Oracle Cloud Ampere A1 (ARM64) instance and connecting the **Cloudflare Worker** to it.

## Part 1: Oracle Backend Deployment

### Prerequisites
- An Oracle Cloud VM (Ubuntu or Oracle Linux).
- Docker and Docker Compose installed on the VM.
- Port `8080` (or your chosen port) open in the Oracle Cloud Security List / Firewall.

### 1. Transfer Files
Copy the `oracle-backend` directory to your server. 
```bash
# Example using scp
scp -r oracle-backend opc@your-server-ip:~/oracle-backend
```

### 2. Configure Secrets
On the server, edit `docker-compose.yml` or create a `.env` file to set a strong secret.
```bash
cd ~/oracle-backend

# 1. Set your shared secret (must match Cloudflare Worker)
export DO_SHARED_SECRET="your-password-here"

# 2. Google Sheets Configuration (Required for 12:15 AM scheduled flush)
# Create a Google Sheet and share it with your Service Account email
export SHEETS_ID="your-google-sheet-id"
# Ensure your service account JSON is at ./google-credentials.json
export GOOGLE_CREDS_PATH="/app/google-credentials.json"
```

#### Getting Google Sheets Credentials
1. Create a Project in [Google Cloud Console](https://console.cloud.google.com/).
2. Enable **"Google Sheets API"**.
3. Create a **Service Account** and download the JSON key.
4. Rename it to `google-credentials.json` and place it in `oracle-backend/`.
5. Create a new Google Sheet.
6. **Share** the sheet with the Service Account email address (Editor access).
7. Copy the Sheet ID from the URL: `docs.google.com/spreadsheets/d/THIS_PART_IS_THE_ID/edit`

### 3. Deploy
Start the service using Docker Compose.
```bash
# Build and start in detached mode
docker-compose up -d --build
```

### 4. Verify
Check if the service is running:
```bash
curl http://localhost:8080/health
# Expected: {"ok":true}
```

---

## Part 2: Cloudflare Worker Configuration

Once the backend is live, you need to tell the worker where to send data.

### 1. Update Configuration
Edit `cloudflare-worker/wrangler.toml`:

```toml
[vars]
# Replace with your Oracle VM's public IP or Domain
ORACLE_ENDPOINT = "http://<YOUR_ORACLE_IP>:8080/ingest-batch"

# Must match the secret you set in Docker Compose
DO_SHARED_SECRET = "your-super-secret-password-here"
```

### 2. Deploy Worker
```bash
cd cloudflare-worker
npm run deploy
```

## Maintenance

### Updating the Backend
To update the backend code on the server:
1. `git pull` or upload new files.
2. `docker-compose up -d --build` (this rebuilds and restarts with minimal downtime).

### Viewing Logs
```bash
docker-compose logs -f --tail=100
```
