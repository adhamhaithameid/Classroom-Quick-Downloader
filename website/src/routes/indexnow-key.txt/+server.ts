import { INDEXNOW_KEY } from '$lib/config';

export const prerender = true;

export function GET() {
  if (!INDEXNOW_KEY) {
    return new Response('IndexNow key is not configured.\n', {
      status: 404,
      headers: {
        'content-type': 'text/plain; charset=utf-8'
      }
    });
  }

  return new Response(`${INDEXNOW_KEY}\n`, {
    headers: {
      'content-type': 'text/plain; charset=utf-8'
    }
  });
}
