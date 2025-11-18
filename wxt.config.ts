// filepath: wxt.config.ts
import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    permissions: ['downloads'],
    host_permissions: [
      'https://drive.google.com/*',
      'https://classroom.google.com/*',
      'https://accounts.google.com/*',
    ],
  },
});
