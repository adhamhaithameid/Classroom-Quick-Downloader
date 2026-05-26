const LEGACY_HOST = 'classroom-quick-downloader-website.pages.dev';
const CANONICAL_HOST = 'classroom-quick-downloader.adhamhaithameid.is-a.dev';
const EMAILS_PATH = '/emails';
const EMAILS2_PATH = '/emails2';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.hostname === LEGACY_HOST) {
      url.hostname = CANONICAL_HOST;
      return Response.redirect(url.toString(), 301);
    }

    if (url.pathname === EMAILS_PATH || url.pathname === `${EMAILS_PATH}/`) {
      url.pathname = EMAILS2_PATH;
      return Response.redirect(url.toString(), 308);
    }

    return env.ASSETS.fetch(request);
  }
};
