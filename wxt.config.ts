// filepath: wxt.config.ts
import { defineConfig } from 'wxt';

export default defineConfig({
  // Keep your existing modules here
  modules: ['@wxt-dev/module-react'],

  manifest: {
    // Add / merge with your existing permissions
    permissions: ['downloads', 'tabs'],

    // Hosts this extension is allowed to talk to
    host_permissions: [
      'https://drive.google.com/*',
      'https://classroom.google.com/*',
      'https://drive.usercontent.google.com/*',
      'https://accounts.google.com/*',
    ],
  },
});
