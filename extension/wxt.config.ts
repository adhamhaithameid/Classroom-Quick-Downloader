// filepath: extension/wxt.config.ts
import { defineConfig } from 'wxt';

export default defineConfig({
  runner: {
    binaries: {
      // Path for Brave on macOS
      chrome: '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
    },
    // Optional: Keep your logins and pins in a dev profile
    chromiumArgs: ['--user-data-dir=./.wxt/brave-data'],
    startUrls: ['https://classroom.google.com'],
  },
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: "Classroom Quick Downloader",
    short_name: "Classroom Quick Downloader",
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
    ],
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
});