const LEGACY_HOST = 'classroom-quick-downloader-website.pages.dev';
const CANONICAL_HOST = 'classroom-quick-downloader.adhamhaithameid.is-a.dev';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.hostname === LEGACY_HOST) {
      url.hostname = CANONICAL_HOST;
      return Response.redirect(url.toString(), 301);
    }

    return env.ASSETS.fetch(request);
  }
};
