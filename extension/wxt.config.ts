// filepath: extension/wxt.config.ts
import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
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
  },
});