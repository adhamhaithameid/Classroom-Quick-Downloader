
import { describe, it, expect, vi, beforeEach } from 'vitest';
import worker from '../src/index';

describe('Authentication Timing Safety', () => {
  const env = {
    DO_SHARED_SECRET: 'secret123',
    DASHBOARD_PASSWORD: 'password123',
    DANGER_PASSWORD: 'danger123',
    DOWNLOADS_DO: {
      idFromName: vi.fn().mockReturnValue('stub-id'),
      get: vi.fn().mockReturnValue({
        fetch: vi.fn().mockImplementation((req) => {
          // Mock responses based on URL
          const url = req.url || '';
          if (url.includes('/auth/check-ip-allowlist')) {
             return Promise.resolve(new Response(JSON.stringify({ allowed: true, enabled: true }), { status: 200 }));
          }
          if (url.includes('/auth/login-attempt')) {
             return Promise.resolve(new Response(JSON.stringify({ allowed: true }), { status: 200 }));
          }
          return Promise.resolve(new Response(JSON.stringify({ allowed: true }), { status: 200 }));
        }),
      }),
    },
  };

  it('should allow login with correct dashboard password', async () => {
    const formData = new FormData();
    formData.append('password', 'password123');

    // Do NOT set Content-Type header manually when sending FormData
    const request = new Request('http://localhost/', {
      method: 'POST',
      body: formData,
    });

    const res = await worker.fetch(request, env as any, {} as any);
    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toBe('/dashboard');
  });

  it('should deny login with incorrect dashboard password', async () => {
    const formData = new FormData();
    formData.append('password', 'wrong');

    const request = new Request('http://localhost/', {
      method: 'POST',
      body: formData,
    });

    const res = await worker.fetch(request, env as any, {} as any);
    expect(res.status).toBe(401);
  });

  it('should allow danger verification with correct password', async () => {
    const request = new Request('http://localhost/auth/verify-danger', {
      method: 'POST',
      body: JSON.stringify({ password: 'danger123' }),
      headers: {
        'content-type': 'application/json',
      }
    });

    const res = await worker.fetch(request, env as any, {} as any);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ok: true });
  });

  it('should deny danger verification with incorrect password', async () => {
    const request = new Request('http://localhost/auth/verify-danger', {
      method: 'POST',
      body: JSON.stringify({ password: 'wrong' }),
      headers: {
        'content-type': 'application/json',
      }
    });

    const res = await worker.fetch(request, env as any, {} as any);
    expect(res.status).toBe(401);
  });
});
