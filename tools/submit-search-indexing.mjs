#!/usr/bin/env node

import { createSign } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const DEFAULT_SITE_URL = 'https://classroom-quick-downloader-website.pages.dev';
const DEFAULT_SITEMAP_PATH = '/sitemap.xml';
const DEFAULT_INDEXNOW_ENDPOINT = 'https://www.bing.com/indexnow';
const INDEXNOW_REGISTRY_URL = 'https://www.indexnow.org/searchengines.json';
const GOOGLE_TOKEN_URI = 'https://oauth2.googleapis.com/token';
const GOOGLE_SCOPE = 'https://www.googleapis.com/auth/webmasters';
const BRAVE_SUBMIT_URL = 'https://search.brave.com/submit-url';

function trimTrailingSlash(value) {
  return value.replace(/\/+$/, '');
}

function normalizeSiteUrl(raw) {
  const fallback = trimTrailingSlash(DEFAULT_SITE_URL);
  const candidate = (raw ?? '').trim();
  if (!candidate) return fallback;
  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return fallback;
    return trimTrailingSlash(parsed.origin + parsed.pathname);
  } catch {
    return fallback;
  }
}

function toSiteProperty(rawSiteUrl) {
  const normalized = normalizeSiteUrl(rawSiteUrl);
  return `${normalized}/`;
}

function normalizeAbsoluteUrl(rawValue, fallback) {
  const candidate = (rawValue ?? '').trim();
  if (!candidate) return fallback;
  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return fallback;
    return parsed.toString();
  } catch {
    return fallback;
  }
}

function decodeXmlEntities(value) {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

function parseSitemapLocs(xmlText) {
  const urls = [];
  const pattern = /<loc>([^<]+)<\/loc>/g;
  let match;
  while ((match = pattern.exec(xmlText)) !== null) {
    const parsed = decodeXmlEntities(match[1].trim());
    if (parsed) urls.push(parsed);
  }
  return [...new Set(urls)];
}

async function fetchText(url, init = undefined) {
  const response = await fetch(url, init);
  const body = await response.text();
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText} from ${url}: ${body.slice(0, 500)}`);
  }
  return body;
}

async function fetchJson(url, init = undefined) {
  const body = await fetchText(url, init);
  try {
    return JSON.parse(body);
  } catch (error) {
    throw new Error(`Expected JSON response from ${url}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function loadGoogleServiceAccount() {
  const inlineJson = (process.env.GOOGLE_SEARCH_CONSOLE_CREDENTIALS_JSON ?? '').trim();
  const filePath = (process.env.GOOGLE_SEARCH_CONSOLE_CREDENTIALS_PATH ?? '').trim();
  if (!inlineJson && !filePath) return null;

  const raw = inlineJson || await readFile(filePath, 'utf8');
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error(`Failed to parse Google credentials JSON: ${error instanceof Error ? error.message : String(error)}`);
  }

  const clientEmail = typeof parsed.client_email === 'string' ? parsed.client_email.trim() : '';
  const privateKey = typeof parsed.private_key === 'string' ? parsed.private_key.replace(/\\n/g, '\n').trim() : '';
  const tokenUri = typeof parsed.token_uri === 'string' && parsed.token_uri.trim() ? parsed.token_uri.trim() : GOOGLE_TOKEN_URI;

  if (!clientEmail || !privateKey) {
    throw new Error('Google credentials must include client_email and private_key.');
  }

  return { clientEmail, privateKey, tokenUri };
}

function toBase64UrlJson(value) {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

async function getGoogleAccessToken(serviceAccount) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: serviceAccount.clientEmail,
    scope: GOOGLE_SCOPE,
    aud: serviceAccount.tokenUri,
    iat: now - 30,
    exp: now + 3600
  };

  const unsignedJwt = `${toBase64UrlJson(header)}.${toBase64UrlJson(payload)}`;
  const signer = createSign('RSA-SHA256');
  signer.update(unsignedJwt);
  signer.end();
  const signature = signer.sign(serviceAccount.privateKey).toString('base64url');
  const assertion = `${unsignedJwt}.${signature}`;

  const response = await fetch(serviceAccount.tokenUri, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion
    })
  });

  const bodyText = await response.text();
  if (!response.ok) {
    throw new Error(`Token exchange failed with HTTP ${response.status}: ${bodyText.slice(0, 500)}`);
  }

  let data;
  try {
    data = JSON.parse(bodyText);
  } catch (error) {
    throw new Error(`Token response was not valid JSON: ${error instanceof Error ? error.message : String(error)}`);
  }

  if (!data.access_token) {
    throw new Error('Token response did not include access_token.');
  }
  return String(data.access_token);
}

async function submitGoogleSitemap({ siteProperty, sitemapUrl, accessToken, dryRun }) {
  if (dryRun) {
    console.log(`[indexing] DRY_RUN=1: would submit sitemap to Google Search Console for property ${siteProperty}`);
    return;
  }

  const endpoint = `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteProperty)}/sitemaps/${encodeURIComponent(sitemapUrl)}`;
  const response = await fetch(endpoint, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });
  const bodyText = await response.text();
  if (!response.ok) {
    throw new Error(`Google sitemap submission failed with HTTP ${response.status}: ${bodyText.slice(0, 500)}`);
  }
}

async function submitIndexNow({ endpoint, siteUrl, key, keyLocation, urls, dryRun }) {
  const host = new URL(siteUrl).host;
  const payload = {
    host,
    key,
    keyLocation,
    urlList: urls
  };

  if (dryRun) {
    console.log(`[indexing] DRY_RUN=1: would send ${urls.length} URLs to IndexNow endpoint ${endpoint}`);
    return;
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'content-type': 'application/json; charset=utf-8'
    },
    body: JSON.stringify(payload)
  });
  const bodyText = await response.text();
  if (!response.ok) {
    throw new Error(`IndexNow submission failed with HTTP ${response.status}: ${bodyText.slice(0, 500)}`);
  }
}

async function loadIndexNowEndpoints(primaryEndpoint) {
  const endpoints = new Set([primaryEndpoint]);
  try {
    const registry = await fetchJson(INDEXNOW_REGISTRY_URL);
    if (!registry || typeof registry !== 'object') {
      return [...endpoints];
    }

    for (const metaUrl of Object.values(registry)) {
      if (typeof metaUrl !== 'string' || !metaUrl.startsWith('https://')) continue;
      try {
        const metadata = await fetchJson(metaUrl);
        if (metadata && typeof metadata.api === 'string' && metadata.api.startsWith('https://')) {
          endpoints.add(metadata.api);
        }
      } catch (error) {
        console.warn(`[indexing] IndexNow metadata fetch skipped for ${metaUrl}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  } catch (error) {
    console.warn(`[indexing] IndexNow registry fetch skipped: ${error instanceof Error ? error.message : String(error)}`);
  }
  return [...endpoints];
}

async function main() {
  const dryRun = process.env.DRY_RUN === '1' || process.env.INDEXING_DRY_RUN === '1';

  const siteUrl = normalizeSiteUrl(process.env.PUBLIC_SITE_URL || process.env.SITE_URL || DEFAULT_SITE_URL);
  const sitemapUrl = normalizeAbsoluteUrl(process.env.SITEMAP_URL, `${siteUrl}${DEFAULT_SITEMAP_PATH}`);
  console.log(`[indexing] Site URL: ${siteUrl}`);
  console.log(`[indexing] Sitemap URL: ${sitemapUrl}`);

  const sitemapXml = await fetchText(sitemapUrl);
  const sitemapUrls = parseSitemapLocs(sitemapXml);
  if (!sitemapUrls.length) {
    throw new Error(`No <loc> entries found in sitemap: ${sitemapUrl}`);
  }
  console.log(`[indexing] Parsed ${sitemapUrls.length} URLs from sitemap.`);

  const errors = [];

  const indexNowKey = (process.env.INDEXNOW_KEY || process.env.PUBLIC_INDEXNOW_KEY || '').trim();
  if (indexNowKey) {
    const allEngines = (process.env.INDEXNOW_ALL_ENGINES ?? '1').trim() !== '0';
    const keyLocationDefault = `${siteUrl}/indexnow-key.txt`;
    const keyLocation = normalizeAbsoluteUrl(process.env.INDEXNOW_KEY_LOCATION, keyLocationDefault);
    const indexNowEndpoint = normalizeAbsoluteUrl(process.env.INDEXNOW_ENDPOINT, DEFAULT_INDEXNOW_ENDPOINT);

    const endpoints = allEngines
      ? await loadIndexNowEndpoints(indexNowEndpoint)
      : [indexNowEndpoint];

    let indexNowSuccessCount = 0;
    for (const endpoint of endpoints) {
      try {
        await submitIndexNow({
          endpoint,
          siteUrl,
          key: indexNowKey,
          keyLocation,
          urls: sitemapUrls,
          dryRun
        });
        indexNowSuccessCount += 1;
        console.log(`[indexing] IndexNow submission sent to ${endpoint}`);
      } catch (error) {
        console.warn(`[indexing] IndexNow submission failed for ${endpoint}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    if (indexNowSuccessCount === 0) {
      errors.push('[indexnow] Failed to submit URLs to all IndexNow endpoints.');
    } else {
      console.log(`[indexing] IndexNow submission completed for ${indexNowSuccessCount}/${endpoints.length} endpoint(s).`);
    }
  } else {
    console.log('[indexing] Skipped IndexNow submission (INDEXNOW_KEY is not set).');
  }

  console.log(`[indexing] Brave Search URL submission remains manual: ${BRAVE_SUBMIT_URL}`);
  console.log('[indexing] DuckDuckGo typically reflects Bing indexing, so successful Bing/IndexNow submissions help DuckDuckGo visibility.');

  try {
    const serviceAccount = await loadGoogleServiceAccount();
    if (!serviceAccount) {
      console.log('[indexing] Skipped Google Search Console submission (credentials not set).');
    } else {
      const siteProperty = (process.env.GOOGLE_SEARCH_CONSOLE_SITE_URL ?? '').trim() || toSiteProperty(siteUrl);
      const accessToken = await getGoogleAccessToken(serviceAccount);
      await submitGoogleSitemap({
        siteProperty,
        sitemapUrl,
        accessToken,
        dryRun
      });
      console.log(`[indexing] Google Search Console sitemap submitted for property: ${siteProperty}`);
    }
  } catch (error) {
    errors.push(`[google-search-console] ${error instanceof Error ? error.message : String(error)}`);
  }

  if (errors.length > 0) {
    console.error('[indexing] Completed with errors:');
    for (const message of errors) {
      console.error(`  - ${message}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log('[indexing] Completed without errors.');
}

main().catch((error) => {
  console.error(`[indexing] Fatal error: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
