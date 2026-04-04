import { redirect, type Handle } from '@sveltejs/kit';

const LEGACY_HOST = 'classroom-quick-downloader-website.pages.dev';
const PRIMARY_ORIGIN = 'https://classroom-quick-downloader.adhamhaithameid.is-a.dev';

export const handle: Handle = async ({ event, resolve }) => {
  if (event.url.hostname === LEGACY_HOST) {
    const location = `${PRIMARY_ORIGIN}${event.url.pathname}${event.url.search}`;
    throw redirect(301, location);
  }

  return resolve(event);
};
