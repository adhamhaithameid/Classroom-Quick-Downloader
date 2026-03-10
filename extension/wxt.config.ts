// filepath: extension/wxt.config.ts
import { defineConfig } from 'wxt';

const LOCAL_DEV_ORIGINS = ['http://localhost:3000', 'http://localhost:3001'];
const LOCAL_DEV_SOCKETS = ['ws://localhost:3000', 'ws://localhost:3001'];
const isDevelopment = process.env.NODE_ENV !== 'production';
const devConnectSources = isDevelopment
  ? ` ${LOCAL_DEV_ORIGINS.join(' ')} ${LOCAL_DEV_SOCKETS.join(' ')}`
  : '';
const devImageSources = isDevelopment
  ? ` ${LOCAL_DEV_ORIGINS.join(' ')}`
  : '';

// the runner should be webExt
export default defineConfig({
  webExt: {
    // Only configure custom browser if environment variable is set
    ...(process.env.VITE_DEV_BROWSER_PATH && {
      binaries: {
        chrome: process.env.VITE_DEV_BROWSER_PATH,
      },
    }),
    // Optional: Custom user data directory for dev profile
    ...(process.env.VITE_DEV_USER_DATA_DIR && {
      chromiumArgs: [`--user-data-dir=${process.env.VITE_DEV_USER_DATA_DIR}`],
    }),
    startUrls: ['https://classroom.google.com'],
  },
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: "Classroom Quick Downloader",
    short_name: "Classroom Quick Downloader",
    homepage_url: "https://classroom-quick-downloader-website.pages.dev",
    permissions: [
      'downloads',
      'tabs',
      'storage',
      'alarms'
    ],
    host_permissions: [
      'https://drive.google.com/*',
      'https://classroom.google.com/*',
      'https://drive.usercontent.google.com/*',
      'https://accounts.google.com/*',
      'https://cqd-analytics.adhamhaithameid.workers.dev/*',
      'https://oracle.classroom-quick-downloader.com/*',
    ],
    content_security_policy: {
      extension_pages: `script-src 'self'; object-src 'self'; connect-src 'self' https://*.google.com https://*.googleapis.com https://*.googleusercontent.com https://cqd-analytics.adhamhaithameid.workers.dev https://oracle.classroom-quick-downloader.com${devConnectSources}; img-src 'self' https://*.google.com https://*.googleusercontent.com data:${devImageSources};`,
    },
    icons: {
      "16": "icon/16.png",
      "32": "icon/32.png",
      "48": "icon/48.png",
      "96": "icon/96.png",
      "128": "icon/128.png"
    },
    browser_specific_settings: {
      gecko: {
        id: "classroom-quick-downloader@adhamhaitham.dev",
        // @ts-expect-error: Firefox specific key not in WXT types
        data_collection_permissions: {
          required: ["none"]
        },
        strict_min_version: "109.0"
      }
    }
  },
  publicDir: 'src',
});
