import http from 'k6/http';
import { check, sleep } from 'k6';

// Usage:
// BASE_URL=http://localhost:8080 SESSION_COOKIE="oracle_session=..." k6 run tests/performance/k6_load_template.js

const baseURL = __ENV.BASE_URL || 'http://localhost:8080';
const sessionCookie = __ENV.SESSION_COOKIE || '';

export const options = {
  stages: [
    { duration: '30s', target: 10 },
    { duration: '1m', target: 30 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<500'],
  },
};

function authHeaders() {
  if (!sessionCookie) return {};
  return {
    Cookie: sessionCookie,
  };
}

export default function () {
  const healthRes = http.get(`${baseURL}/health`);
  check(healthRes, {
    'health status is 200': (r) => r.status === 200,
  });

  const summaryRes = http.get(`${baseURL}/api/stats/summary`, {
    headers: authHeaders(),
  });
  check(summaryRes, {
    'summary status is 200 or 401 (if auth cookie omitted)': (r) => r.status === 200 || r.status === 401,
  });

  const tsRes = http.get(`${baseURL}/api/stats/timeseries?from=2026-01-01&to=2026-01-31`, {
    headers: authHeaders(),
  });
  check(tsRes, {
    'timeseries status is 200 or 401 (if auth cookie omitted)': (r) => r.status === 200 || r.status === 401,
  });

  sleep(1);
}
