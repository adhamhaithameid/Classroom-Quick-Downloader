// filepath: extension/wxt.config.ts
import { defineConfig } from 'wxt';

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
      'unlimitedStorage',
      'alarms'
    ],
    host_permissions: [
      'https://drive.google.com/*',
      'https://classroom.google.com/*',
      'https://drive.usercontent.google.com/*',
      'https://accounts.google.com/*',
      'https://cqd-analytics.adhamhaithameid.workers.dev/*',
    ],
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
